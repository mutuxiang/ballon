import * as THREE from 'three';
import {createDancer} from './model.mjs';
import {createClothing} from './clothing.js';
import {AirPhysics} from './physics.js';

// Art-direct two frozen poses with the same body/arm deformer as the live model.
// The bend comes from the spine itself, not a rotation of a straight silhouette.
function addBackdropFace(dancer,wink){
  const material=new THREE.MeshBasicMaterial({color:'#343532',side:THREE.DoubleSide});
  function stroke(points){
    const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>{
      const radius=.66-.025*(y-.64)/4.9;
      return new THREE.Vector3(x,y,Math.sqrt(radius*radius-x*x)+.055);
    }));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,32,.022,6,false),material);
    mesh.name='Backdrop_expression';mesh.userData.deformWithBody=true;dancer.add(mesh);
  }
  // Closed smiling lids on one pose; a wink and an open eye on the other.
  stroke([[-.42,4.82],[-.28,4.91],[-.13,4.82]]);
  if(wink){
    stroke(Array.from({length:25},(_,i)=>{const a=i/24*Math.PI*2;return [.27+Math.cos(a)*.09,4.83+Math.sin(a)*.13];}));
    stroke([[.27,4.89],[.27,4.78]]);
  }else stroke([[.13,4.82],[.28,4.91],[.42,4.82]]);
  stroke([[.02,4.73],[-.035,4.57],[.055,4.57]]);
  stroke([[-.29,4.43],[-.14,4.29],[.07,4.27],[.29,4.43]]);
  if(!wink)stroke([[-.29,4.43],[0,4.39],[.29,4.43]]);
  dancer.userData.expression=wink?'wink-smile':'closed-eye-laugh';
}

export function freezeDancerPose(seed,direction){
  const dancer=createDancer({rest:true,face:false,separateFace:true}).group;
  createClothing(dancer).select('pastel');
  addBackdropFace(dancer,direction<0);
  const physics=new AirPhysics(dancer,{seed,planar:true,depthMotion:0});
  const angles=[];
  for(let i=1;i<physics.nodes.length;i++){
    const u=(i-1)/23;
    const angle=direction>0?1.5*Math.sin(Math.PI*u)-.95*u:-(1.3*Math.sin(1.7*Math.PI*u)+.25*u);
    angles.push(angle);
    const node=physics.nodes[i];
    node.p.copy(physics.nodes[i-1].p).add(new THREE.Vector3(Math.sin(angle),Math.cos(angle),0).multiplyScalar(4.9/24));
    node.old.copy(node.p);
  }
  // Arms follow the posed shoulder, with a different sweeping gesture per side.
  for(const arm of physics.arms)for(let i=0;i<arm.nodes.length;i++){
    const u=i/6,point=physics.bodyPosition(arm.sign*(.5+u*1.04),3.677,0);
    point.y+=Math.sin(u*Math.PI/2)*(arm.sign===direction?.65:-.45);
    arm.nodes[i].p.copy(point);arm.nodes[i].old.copy(point);
  }
  physics.deform();
  dancer.traverse(mesh=>{if(mesh.isMesh&&mesh.geometry.attributes.position.count){mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();}});
  const bounds=new THREE.Box3().setFromObject(dancer),center=bounds.getCenter(new THREE.Vector3());
  // Anchor the waist so the visibly curved middle stays inside the viewport.
  center.copy(physics.nodes[12].p);
  dancer.position.sub(center);
  const frame=new THREE.Group();frame.add(dancer);
  frame.userData.poseSize=bounds.getSize(new THREE.Vector3());
  frame.userData.spine=physics.nodes.map(n=>n.p.clone().sub(center));
  frame.userData.bendRange=Math.max(...angles)-Math.min(...angles);
  frame.userData.expression=dancer.userData.expression;
  return frame;
}

export function layoutBackdropPose(pose,index,width,height){
  const viewHeight=16,viewWidth=viewHeight*width/height,narrow=width<700;
  const size=pose.userData.poseSize;
  const scale=Math.min(viewHeight*(index?1.35:1.4)/size.y,viewWidth*(narrow?.92:.62)/size.x);
  pose.scale.setScalar(scale);
  pose.rotation.z=(index?10:-9)*Math.PI/180;
  pose.position.set(viewWidth*(index?.39:-.39),viewHeight*(index?-.23:.02),0);
  pose.updateMatrixWorld(true);
}

function monochrome(root){
  const paper=new THREE.Color('#e7dac4'),ink=new THREE.Color('#896b4d'),oldMaterials=new Set();
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const original=mesh.material;oldMaterials.add(original);
    const c=original.color||ink;
    const darkness=1-THREE.MathUtils.clamp(c.r*.2126+c.g*.7152+c.b*.0722,0,1);
    // One warm ink hue, with lighter tint for skin/shirt to preserve facial detail.
    mesh.material=new THREE.MeshBasicMaterial({color:paper.clone().lerp(ink,.3+darkness*.7),side:THREE.DoubleSide});
  });
  oldMaterials.forEach(material=>material.dispose());
}

export function createPoseBackdrop(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.setClearColor(0,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-10,10,8,-8,.1,100);
  camera.position.z=25;
  const poses=[freezeDancerPose(4721,1),freezeDancerPose(8107,-1)];
  for(const pose of poses){monochrome(pose);scene.add(pose);}
  return {
    resize(width,height){
      const viewHeight=16,viewWidth=viewHeight*width/height;
      camera.left=-viewWidth/2;camera.right=viewWidth/2;camera.updateProjectionMatrix();
      poses.forEach((pose,index)=>layoutBackdropPose(pose,index,width,height));
      renderer.setSize(width,height,false);renderer.render(scene,camera);
    },
    dispose(){
      scene.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.dispose();mesh.material.dispose();}});
      renderer.dispose();
    }
  };
}
