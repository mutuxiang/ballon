import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {freezeDancerPose} from './pose-backdrop.js';

test('background frames freeze two different bends without sharing live geometry',()=>{
  const a=freezeDancerPose(4721,1),hairA=a.getObjectByName('Hair');
  const frozen=hairA.geometry.attributes.position.array.slice();
  const b=freezeDancerPose(8107,-1),hairB=b.getObjectByName('Hair');
  const headA=hairA.geometry.boundingBox.getCenter(new Vector3()),headB=hairB.geometry.boundingBox.getCenter(new Vector3());
  assert.ok(headA.x>1);assert.ok(headB.x<-1);
  assert.notEqual(hairA.geometry,hairB.geometry);
  assert.deepEqual(hairA.geometry.attributes.position.array,frozen);
  for(const pose of [a,b]){
    assert.ok(pose.userData.poseSize.y>3);
    pose.traverse(mesh=>{if(mesh.isMesh){assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));mesh.geometry.dispose();mesh.material.dispose();}});
  }
});
