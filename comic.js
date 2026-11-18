import * as THREE from 'three';

const DRAWING_FPS=12, SEGMENTS=8;
const noise=(seed,frame)=>{const value=Math.sin(seed*127.1+frame*311.7)*43758.5453;return (value-Math.floor(value))*2-1;};

// Camera-facing ink lives BEHIND the actual character and uses depth testing.
// It stays a background illustration when orbiting, never a foreground overlay.
export function createComicHatching(scene,camera){
  const strokes=Array.from({length:10},(_,i)=>({kind:'body',y:2.35+i/9*3.38,seed:i+1}));
  for(const sign of [-1,1])for(let i=0;i<1;i++)strokes.push({kind:'arm',sign,index:2+i,seed:50+(sign+1)*5+i});
  const positions=new Float32Array(strokes.length*(SEGMENTS+1)*2*3),indices=[];
  strokes.forEach((_,stroke)=>{
    const offset=stroke*(SEGMENTS+1)*2;
    for(let i=0;i<SEGMENTS;i++){const a=offset+i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  });
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
  const material=new THREE.MeshBasicMaterial({color:0x343532,side:THREE.DoubleSide,transparent:true,depthTest:true,depthWrite:false});
  material.userData.outlineParameters={visible:false};
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Comic_background_lines';mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);
  const inverse=new THREE.Quaternion(),forward=new THREE.Vector3(),local=new THREE.Vector3(),anchor=new THREE.Vector3(),previousHead=new THREE.Vector3();
  const motion=new THREE.Vector3();
  let enabled=false,time=0,frame=0,velocity=0,hasPrevious=false;
  function update(dt,simulation){
    if(!enabled)return;
    const delta=Number.isFinite(dt)?Math.max(0,dt):0;
    time+=delta;frame=Math.floor(time*DRAWING_FPS);
    const head=simulation.nodes[24].p;
    if(delta>0){
      const speed=hasPrevious?head.distanceTo(previousHead)/Math.max(delta,.001):0;
      velocity=THREE.MathUtils.lerp(velocity,Math.min(speed,6),1-Math.exp(-delta*5));
      if(hasPrevious)motion.copy(head).sub(previousHead).divideScalar(Math.max(delta,.001));
      previousHead.copy(head);hasPrevious=true;
    }
    camera.updateMatrixWorld();inverse.copy(camera.quaternion).invert();forward.set(0,0,-1).applyQuaternion(camera.quaternion);
    // Put the entire ink plane farther away than every body/arm node and crown.
    let distance=1;
    for(const node of simulation.nodes)distance=Math.max(distance,local.copy(node.p).sub(camera.position).dot(forward)+1.3);
    for(const arm of simulation.arms)for(const node of arm.nodes)distance=Math.max(distance,local.copy(node.p).sub(camera.position).dot(forward)+1.3);
    mesh.position.copy(camera.position).addScaledVector(forward,distance);mesh.quaternion.copy(camera.quaternion);
    let offset=0;
    for(const stroke of strokes){
      let lean=0;
      if(stroke.kind==='body'){
        const body=simulation.sample(stroke.y);anchor.copy(body.c);
        local.copy(body.t).applyQuaternion(inverse);lean=THREE.MathUtils.clamp(Math.atan2(local.x,local.y),-.9,.9);
      }else anchor.copy(simulation.arms[stroke.sign<0?0:1].nodes[stroke.index].p);
      local.copy(anchor).sub(camera.position).applyQuaternion(inverse);
      const scale=distance/Math.max(.2,-local.z),x=local.x*scale,y=local.y*scale;
      const direction=motion.clone().applyQuaternion(inverse);
      const seed=stroke.seed,angle=Math.atan2(-direction.y,-direction.x)+noise(seed,0)*.025;
      const dx=Math.cos(angle),dy=Math.sin(angle),nx=-dy,ny=dx;
      // Each stroke has its own length envelope, frame-to-frame variation and
      // small asymmetric kinks instead of a shared, mechanically pulsing scale.
      const envelope=Math.sin(time*(1.1+(seed%7)*.17)+seed*2.7)*.13;
      const length=THREE.MathUtils.clamp(velocity*.38,0,1.8)*(1+noise(seed,0)*.15)*scale;
      const startX=x+(stroke.kind==='body'?.08:stroke.sign<0?-.58:.02)*scale;
      const startY=y+(stroke.kind==='body'?-.12:-.18)*scale;
      const jitterX=noise(seed+100,frame)*.016*scale,jitterY=noise(seed+200,frame)*.016*scale;
      for(let i=0;i<=SEGMENTS;i++){
        const t=i/SEGMENTS;
        const kink=(noise(seed*19+i,frame)*.014+Math.sin(t*Math.PI*2+seed)*.012)*scale;
        const cx=startX+dx*length*t+nx*kink+jitterX,cy=startY+dy*length*t+ny*kink+jitterY;
        const halfWidth=.012*scale*Math.pow(Math.sin(Math.PI*t),.45)*(1+noise(seed*31+i,frame)*.12);
        for(const side of [-1,1]){positions[offset++]=cx+nx*halfWidth*side;positions[offset++]=cy+ny*halfWidth*side;positions[offset++]=0;}
      }
    }
    geometry.attributes.position.needsUpdate=true;
  }
  return {
    mesh,
    get enabled(){return enabled;},get frame(){return frame;},get time(){return time;},
    setEnabled(value){const next=Boolean(value);if(next&&!enabled)hasPrevious=false;enabled=next;mesh.visible=enabled;},
    update
  };
}
