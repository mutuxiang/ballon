import * as THREE from 'three';

export const DURATION = 8;
const FRAMES = 64;
const HEIGHT = 4.9;
const HEIGHT_SCALE = HEIGHT / 7.6;
export function createDancer({state='high'}={}) {
  if(!['none','low','high'].includes(state))throw new Error('Unknown air state: '+state);
  const empty=state==='none',low=state==='low';
  const group = new THREE.Group(); group.name = 'Air_Dancer';
  const shirt = new THREE.MeshPhysicalMaterial({color:0xc4d8e5, roughness:.32, metalness:0, clearcoat:.28, clearcoatRoughness:.26, side:THREE.DoubleSide});
  const white = new THREE.MeshStandardMaterial({color:0xfff9ec,roughness:.55,side:THREE.DoubleSide});
  const black = new THREE.MeshStandardMaterial({color:0x19221d,roughness:.65,side:THREE.DoubleSide});
  const skin=new THREE.MeshPhysicalMaterial({color:0xffc9ae,roughness:.36,clearcoat:.25,side:THREE.DoubleSide});
  const hair=new THREE.MeshPhysicalMaterial({color:0x343532,roughness:.45,clearcoat:.12,side:THREE.DoubleSide});
  const trousers=new THREE.MeshPhysicalMaterial({color:0x344659,roughness:.38,clearcoat:.18,side:THREE.DoubleSide});
  const materials=[shirt,white,black,skin,hair,trousers];
  for(let i=0;i<materials.length;i++)materials[i]=new THREE.MeshBasicMaterial({color:materials[i].color,side:THREE.DoubleSide});
  const meshNames=['Shirt','White_details','Face_ink','Skin','Hair','Trousers'];
  const buckets = materials.map(()=>[]);
  const indices = materials.map(()=>[]);
  const seams = materials.map(()=>[]);
  function surface(mat, nu, nv, fn, periodic=false) {
    const offset=buckets[mat].length;
    for(let i=0;i<=nu;i++) for(let j=0;j<=nv;j++) buckets[mat].push(t=>fn(i/nu,j/nv,t));
    for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){
      const a=offset+i*(nv+1)+j,b=a+nv+1;
      indices[mat].push(a,b,a+1,b,b+1,a+1);
    }
    if(periodic)for(let i=0;i<=nu;i++)seams[mat].push([offset+i*(nv+1),offset+i*(nv+1)+nv]);
  }
  const poses=[];
  function pressure(t,u) {
    const p=t/FRAMES*Math.PI*2;
    if(empty)return 1;
    if(low)return .91+.035*Math.sin(p-u*3);
    return 1+.065*Math.sin(p*3-u*3)-.035*Math.sin(p*2-u*4);
  }
  function radius(y,t) {
    const u=THREE.MathUtils.clamp((y-.64)/7.6,0,1);
    return (.66-.025*u)*(1+(pressure(t,u)-1)*THREE.MathUtils.smoothstep(u,0,.16));
  }
  for(let f=0;f<FRAMES;f++) {
    const phase=f/FRAMES*Math.PI*2, points=[new THREE.Vector3(0,.64,0)], angles=[0], depths=[0];
    const leftFold=Math.pow(Math.max(0,Math.sin(phase-1.05)),6);
    const rightFold=Math.pow(Math.max(0,Math.sin(phase+1.7)),8);
    for(let i=1;i<=100;i++) {
      const u=i/100,w=THREE.MathUtils.smoothstep(u,0,.22);
      // Air pushes up from the fixed base. Broad folds travel upwards;
      // the upper body lags, overshoots, and springs upright on the next pulse.
      const fold=THREE.MathUtils.smoothstep(u,.22,.85);
      let a=w*(.45*Math.sin(phase*2-u*3.4)+.20*Math.sin(phase*3-u*5.2)+.8*leftFold*fold-.85*rightFold*fold+.1*Math.sin(phase*6-u*8)*u);
      let b=w*.16*Math.sin(phase*2-u*3.1);
      let stretch=1+.045*Math.sin(phase*3-u*3)-.04*(leftFold+rightFold)*Math.exp(-Math.pow((u-.6)/.25,2));
      if(low){a=w*(.9+.36*Math.sin(phase-u*2.8)+.62*fold+.1*Math.sin(phase*2-u*4)*u);b=w*.1*Math.sin(phase-u*2);stretch=.68+.025*Math.sin(phase-u*3);}
      if(empty){a=THREE.MathUtils.smoothstep(u,0,.12)*(1.58+.18*Math.sin(u*Math.PI));b=.035*Math.sin(u*6);stretch=.63;}
      angles.push(a);depths.push(b);
      const tangent=new THREE.Vector3(Math.sin(a)*Math.cos(b),Math.cos(a)*Math.cos(b),Math.sin(b));
      points.push(points[i-1].clone().addScaledVector(tangent,HEIGHT/100*stretch));
    }
    poses.push({points,angles,depths});
  }
  function frame(y,t) {
    const p=poses[t], k=THREE.MathUtils.clamp((y-.64)/7.6*100,0,100), i=Math.min(99,Math.floor(k)), s=k-i;
    const a=THREE.MathUtils.lerp(p.angles[i],p.angles[i+1],s);
    const b=THREE.MathUtils.lerp(p.depths[i],p.depths[i+1],s);
    const tangent=new THREE.Vector3(Math.sin(a)*Math.cos(b),Math.cos(a)*Math.cos(b),Math.sin(b));
    const n=new THREE.Vector3(Math.cos(a),-Math.sin(a),0),binormal=n.clone().cross(tangent).normalize();
    const c=p.points[i].clone().lerp(p.points[i+1],s);
    if(y>8.24)c.addScaledVector(tangent,(y-8.24)*HEIGHT_SCALE);
    return {c,n,b:binormal,t:tangent,a};
  }
  function body(x,y,z,t){
    const f=frame(y,t),u=THREE.MathUtils.clamp((y-.64)/7.6,0,1),w=THREE.MathUtils.smoothstep(u,0,.16);
    const squash=empty?1-.78*w:low?1-.22*w:1;
    return f.c.addScaledVector(f.n,x*squash).addScaledVector(f.b,z*(empty?1-.1*w:1));
  }
  // Smooth inflated tube: broad volume changes, no small fabric corrugations.
  for(const [mat,lo,hi,segments] of [[5,.64,2.25,20],[0,2.25,5.65,36],[3,5.65,8.24,28]]) {
    surface(mat,segments,48,(u,v,t)=>{
      const a=v*Math.PI*2,y=THREE.MathUtils.lerp(lo,hi,u),r=radius(y,t);
      return body(Math.cos(a)*r,y,Math.sin(a)*r,t);
    },true);
  }
  function arm(sign,u,t) {
    const phase=t/FRAMES*Math.PI*2, f=frame(5.35,t);
    if(empty)return f.c.addScaledVector(f.b,sign*(.4+u*.78)).addScaledVector(f.t,u*.34).addScaledVector(f.n,.025*Math.sin(u*3));
    const x=sign*((low?.4:.5)+u*1.04),dy=low?-.62*u+.15*Math.sin(phase-u*3+sign)*u:.12*u+Math.sin(phase*3-u*2.3+sign*.8)*.42*u+Math.sin(phase*2+sign*.7-u*.8)*.37*u*u;
    return f.c.addScaledVector(f.n,x).addScaledVector(f.t,dy).addScaledVector(f.b,.17*Math.sin(u*3-phase*3+sign)*u);
  }
  for(const sign of [-1,1]) {
    for(const [mat,lo,hi] of [[0,0,.43],[3,.43,1]])surface(mat,20,24,(s,v,t)=>{
      const u=THREE.MathUtils.lerp(lo,hi,s);
      const c=arm(sign,u,t), tangent=arm(sign,Math.min(1,u+.001),t).sub(arm(sign,Math.max(0,u-.001),t)).normalize();
      const n=new THREE.Vector3(0,0,1).cross(tangent).normalize(), b=tangent.clone().cross(n),a=v*Math.PI*2;
      const r=(.235-.065*u)*pressure(t,u*.5+.45);
      const p=c.clone().addScaledVector(n,Math.cos(a)*r).addScaledVector(b,Math.sin(a)*r);
      if(empty)p.y=c.y+(p.y-c.y)*.22;
      if(low)p.y=Math.max(.06,p.y);
      return p;
    },true);
    // Closed rounded mittens make the short exposed hands look inflated.
    surface(3,12,24,(u,v,t)=>{
      const c=arm(sign,1,t),tangent=c.clone().sub(arm(sign,.999,t)).normalize();
      const n=new THREE.Vector3(0,0,1).cross(tangent).normalize(),b=tangent.clone().cross(n);
      const a=v*Math.PI*2,phi=u*Math.PI/2,r=.17*pressure(t,.95);
      const p=c.clone().addScaledVector(tangent,Math.sin(phi)*r).addScaledVector(n,Math.cos(a)*Math.cos(phi)*r).addScaledVector(b,Math.sin(a)*Math.cos(phi)*r);
      if(empty)p.y=c.y+(p.y-c.y)*.22;
      if(low)p.y=Math.max(.06,p.y);
      return p;
    },true);
  }
  // A closed dark crown with the reference's center-part hairline.
  surface(4,20,64,(u,v,t)=>{
    const a=v*Math.PI*2,front=Math.max(0,Math.sin(a));
    const hairline=7.2+.83*Math.pow(front,5),y=THREE.MathUtils.lerp(hairline,8.24,u),r=radius(y,t)+.014;
    return body(Math.cos(a)*r,y,Math.sin(a)*r,t);
  },true);
  surface(4,16,64,(u,v,t)=>{
    const a=v*Math.PI*2,phi=u*Math.PI/2,r=(radius(8.24,t)+.014)*Math.sin(phi),y=8.24+.26/HEIGHT_SCALE*Math.cos(phi);
    return body(Math.cos(a)*r,y,Math.sin(a)*r,t);
  },true);
  function decal(x,y,t,offset=.025){const r=radius(y,t);return body(x,y,Math.sqrt(Math.max(.01,r*r-x*x))+offset,t);}
  function patch(mat,points,depth=.03){
    const center=points.reduce((p,q)=>[p[0]+q[0]/points.length,p[1]+q[1]/points.length],[0,0]);
    for(let i=0;i<points.length;i++)surface(mat,10,5,(u,v,t)=>{
      const a=points[i],b=points[(i+1)%points.length];
      return decal(center[0]*(1-u)+u*(a[0]*(1-v)+b[0]*v),center[1]*(1-u)+u*(a[1]*(1-v)+b[1]*v),t,depth);
    });
  }
  patch(1,[[-.48,5.65],[0,5.62],[-.22,5.12]]);
  patch(1,[[0,5.62],[.48,5.65],[.22,5.12]]);
  patch(2,[[-.10,5.48],[.10,5.48],[.07,5.14],[-.07,5.14]],.04);
  patch(2,[[-.065,5.14],[.065,5.14],[.14,3.92],[0,3.72],[-.14,3.92]],.04);
  // Flat ink and ivory shapes wrap around the breathing tube like a print.
  function face(x,y,t,offset=.025) {
    const sy=7.05+y/HEIGHT_SCALE,r=radius(sy,t);
    return body(x,sy,Math.sqrt(Math.max(.01,r*r-x*x))+offset,t);
  }
  function disk(mat,cx,cy,rx,ry,offset) {
    surface(mat,3,40,(u,v,t)=>{const a=v*Math.PI*2;return face(cx+rx*u*Math.cos(a),cy+ry*u*Math.sin(a),t,offset);},true);
  }
  function stroke(points,width=.045,offset=.05) {
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],p[1],0)),false,'centripetal');
    surface(2,40,2,(u,v,t)=>{const p=curve.getPoint(u),d=curve.getTangent(u);return face(p.x-d.y*(v-.5)*width,p.y+d.x*(v-.5)*width,t,offset);});
    for(const p of [points[0],points.at(-1)])disk(2,p[0],p[1],width/2,width/2,offset);
  }
  for(const [x,sign] of [[-.255,-1],[.255,1]]) {
    disk(2,x,.20,.19,.205,.027);
    disk(1,x,.20,.148,.163,.034);
    disk(2,x+.015,.195,.073,.076,.042);
    stroke([[x-.16,.218-sign*.027],[x,.23],[x+.16,.218+sign*.027]],.043,.05);
  }
  stroke([[.025,-.075],[-.045,-.095],[-.055,-.18],[-.015,-.215],[.055,-.21]],.046);
  stroke([[.045,-.38],[-.105,-.38],[-.18,-.425],[-.175,-.485],[-.09,-.52],[.005,-.52],[-.11,-.54],[-.14,-.595],[-.10,-.65],[.09,-.655]],.049);
  const tracks=[], times=Array.from({length:FRAMES+1},(_,i)=>i/FRAMES*DURATION);
  buckets.forEach((vertices,m)=>{
    function normals(g){g.computeVertexNormals();const n=g.attributes.normal;for(const [a,b] of seams[m]){const v=new THREE.Vector3().fromBufferAttribute(n,a).add(new THREE.Vector3().fromBufferAttribute(n,b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}}
    const geo=new THREE.BufferGeometry(); geo.setIndex(indices[m]);
    function positions(f){return new Float32Array(vertices.flatMap(fn=>fn(f).toArray()));}
    geo.setAttribute('position',new THREE.BufferAttribute(positions(0),3)); normals(geo);
    geo.morphAttributes.position=[]; geo.morphAttributes.normal=[];
    for(let f=0;!empty&&f<FRAMES;f++) {
      const g=new THREE.BufferGeometry();g.setIndex(indices[m]);g.setAttribute('position',new THREE.BufferAttribute(positions(f),3));normals(g);
      geo.morphAttributes.position.push(g.attributes.position);geo.morphAttributes.normal.push(g.attributes.normal);
    }
    const mesh=new THREE.Mesh(geo,materials[m]);mesh.name=meshNames[m];mesh.castShadow=![1,2].includes(m);mesh.frustumCulled=false;
    if(!empty)mesh.morphTargetInfluences[FRAMES/2]=1;
    group.add(mesh);
    const values=[];for(let f=0;f<=FRAMES;f++)for(let k=0;k<FRAMES;k++)values.push(k===(f+FRAMES/2)%FRAMES?1:0);
    if(!empty)tracks.push(new THREE.NumberKeyframeTrack(mesh.name+'.morphTargetInfluences',times,values));
  });
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.66,.74,.64,48),materials[2]);base.position.y=.32;base.name='Blower';group.add(base);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.655,.035,8,48),new THREE.MeshBasicMaterial({color:0x7d898b}));rim.rotation.x=Math.PI/2;rim.position.y=.62;group.add(rim);
  for(let i=0;i<12;i++){const vent=new THREE.Mesh(new THREE.BoxGeometry(.045,.27,.015),new THREE.MeshBasicMaterial({color:0x080f13}));const a=i/12*Math.PI*2;vent.position.set(Math.sin(a)*.71,.26,Math.cos(a)*.71);vent.rotation.y=a;group.add(vent);}
  const clip=new THREE.AnimationClip('Air_'+state+'_Loop',DURATION,tracks);
  group.userData={description:'Inflatable tired office worker with flat unlit colors',airState:state,units:'meters',animationSeconds:DURATION};
  return {group,clip};
}
