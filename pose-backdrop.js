import * as THREE from 'three';
import {createDancer} from './model.mjs';
import {createClothing} from './clothing.js';
import {AirPhysics} from './physics.js';

// Sample the real solver once. These independent models never join gameplay.
export function freezeDancerPose(seed,direction){
  const dancer=createDancer({rest:true,separateFace:true}).group;
  createClothing(dancer).select('pastel');
  const physics=new AirPhysics(dancer,{seed,planar:true,depthMotion:0});
  physics.setState('high');
  for(let frame=0;frame<240;frame++){
    physics.pedalLean=direction*1.8;
    physics.step(1/120);
  }
  physics.deform();
  dancer.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();}});
  const bounds=new THREE.Box3().setFromObject(dancer),center=bounds.getCenter(new THREE.Vector3());
  dancer.position.sub(center);
  const frame=new THREE.Group();frame.add(dancer);
  frame.userData.poseSize=bounds.getSize(new THREE.Vector3());
  return frame;
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
      const narrow=width<700;
      poses.forEach((pose,index)=>{
        const size=pose.userData.poseSize;
        const scale=Math.min(viewHeight*(index?1.2:1.4)/size.y,viewWidth*(narrow?.86:.54)/size.x);
        pose.scale.setScalar(scale);
        pose.rotation.z=(index?26:-23)*Math.PI/180;
        pose.position.set(viewWidth*(index?.49:-.48),viewHeight*(index?.18:-.1),0);
      });
      renderer.setSize(width,height,false);renderer.render(scene,camera);
    },
    dispose(){
      scene.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.dispose();mesh.material.dispose();}});
      renderer.dispose();
    }
  };
}
