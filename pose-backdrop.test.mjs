import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Box3} from 'three';
import {freezeDancerPose,layoutBackdropPose} from './pose-backdrop.js';

test('background frames freeze two different bends without sharing live geometry',()=>{
  const a=freezeDancerPose(4721,1),hairA=a.getObjectByName('Hair');
  const frozen=hairA.geometry.attributes.position.array.slice();
  const b=freezeDancerPose(8107,-1),hairB=b.getObjectByName('Hair');
  assert.notEqual(hairA.geometry,hairB.geometry);
  assert.deepEqual(hairA.geometry.attributes.position.array,frozen);
  for(const pose of [a,b]){
    assert.ok(pose.userData.poseSize.y>3);
    // A tilted straight model cannot pass: the spine must deviate from the
    // base-to-head chord, and its tangents must turn through a deep arc.
    const spine=pose.userData.spine,base=spine[0],chord=spine.at(-1).clone().sub(base).normalize();
    const bend=Math.max(...spine.map(point=>point.clone().sub(base).cross(chord).length()));
    assert.ok(bend>.7);assert.ok(pose.userData.bendRange>1.8);
    pose.traverse(mesh=>{if(mesh.isMesh){assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));mesh.geometry.dispose();mesh.material.dispose();}});
  }
});

test('both backdrops replace the original face with different attached expressions',()=>{
  const poses=[freezeDancerPose(4721,1),freezeDancerPose(8107,-1)];
  assert.deepEqual(poses.map(p=>p.userData.expression),['closed-eye-laugh','wink-smile']);
  for(const pose of poses){
    assert.equal(pose.getObjectByName('Original_face_ink').geometry.attributes.position.count,0);
    const marks=[];pose.traverse(mesh=>{if(mesh.name==='Backdrop_expression')marks.push(mesh);});
    assert.equal(marks.length,5);
    assert.ok(marks.every(mesh=>mesh.userData.deformWithBody&&mesh.geometry.attributes.position.count>0));
  }
});

test('desktop and portrait layouts retain the bent waist and face while cropping outer extremities',()=>{
  const poses=[freezeDancerPose(4721,1),freezeDancerPose(8107,-1)];
  for(const [width,height] of [[1280,692],[1920,1080],[390,844],[844,390]]){
    const halfWidth=8*width/height;
    poses.forEach((pose,index)=>{
      layoutBackdropPose(pose,index,width,height);
      const waist=pose.userData.spine[12].clone().applyMatrix4(pose.matrixWorld);
      assert.ok(Math.abs(waist.x)<halfWidth*.8&&Math.abs(waist.y)<6);
      const face=new Box3();pose.traverse(mesh=>{if(mesh.name==='Backdrop_expression')face.union(new Box3().setFromObject(mesh));});
      const center=face.getCenter(new Vector3());
      assert.ok(Math.abs(center.x)<halfWidth&&Math.abs(center.y)<7.5,`face must stay visible at ${width}x${height}`);
    });
  }
});
