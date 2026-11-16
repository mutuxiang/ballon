import {writeFile,mkdir} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createDancer} from './model.mjs';
import * as THREE from 'three';
import {AirPhysics} from './physics.js';
globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result='data:'+blob.type+';base64,'+Buffer.from(v).toString('base64');this.onloadend?.();});}
};
await mkdir('public',{recursive:true});
for(const state of ['high','low','none']){
  const {group}=createDancer({rest:true});
  const sim=new AirPhysics(group);sim.setState(state);
  for(let i=0;i<720;i++)sim.step(1/120);
  sim.deform();
  const tracks=[];
  if(state!=='none'){
    const count=49,duration=6;
    for(const {mesh} of sim.meshes){mesh.geometry.morphAttributes.position=[];mesh.geometry.morphAttributes.normal=[];}
    for(let f=0;f<count;f++){
      if(f)for(let i=0;i<15;i++)sim.step(1/120);
      sim.deform();
      for(const {mesh} of sim.meshes){mesh.geometry.morphAttributes.position.push(mesh.geometry.attributes.position.clone());mesh.geometry.morphAttributes.normal.push(mesh.geometry.attributes.normal.clone());}
    }
    for(const {mesh} of sim.meshes){
      mesh.updateMorphTargets();mesh.morphTargetInfluences[0]=1;
      const times=Array.from({length:count},(_,i)=>i/8),values=[];
      for(let i=0;i<count;i++)for(let j=0;j<count;j++)values.push(i===j?1:0);
      tracks.push(new THREE.NumberKeyframeTrack(mesh.name+'.morphTargetInfluences',times,values));
    }
  }
  const clip=new THREE.AnimationClip('Physics_'+state+'_Capture',6,tracks);
  group.userData={airState:state,animationType:state==='none'?'settled pose':'6-second physics capture, not seamless',units:'meters'};
  const output=await new GLTFExporter().parseAsync(group,{binary:true,animations:state==='none'?[]:[clip]});
  const filename=state==='high'?'air-dancer.glb':'air-dancer-'+state+'.glb';
  await writeFile('public/'+filename,Buffer.from(output));
  console.log('Exported',state,output.byteLength,'bytes');
}
