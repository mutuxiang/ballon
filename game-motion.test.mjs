import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {AirPhysics} from './physics.js';
import {applyExerciseMove,updateExerciseTurn} from './game-motion.js';

function setup(){const character=new THREE.Group();return {character,simulation:new AirPhysics(character,{seed:4721,depthMotion:.65})};}
test('opposite exercise directions move the head oppositely while the base stays fixed',()=>{
  for(const [a,b,axis] of [['left','right','x'],['up','down','z']]){
    const first=setup(),second=setup();
    applyExerciseMove(first.simulation,first.character,a,'left');
    applyExerciseMove(second.simulation,second.character,b,'left');
    for(let i=0;i<30;i++){first.simulation.step(1/120);second.simulation.step(1/120);}
    assert.ok(first.simulation.nodes[24].p[axis]<second.simulation.nodes[24].p[axis]);
    assert.deepEqual(first.simulation.nodes[0].p.toArray(),[0,.64,0]);
    for(const node of first.simulation.nodes)assert.ok(node.p.toArray().every(Number.isFinite));
  }
});
test('each pedal turns a different way and automatically returns to face front',()=>{
  const left=setup(),right=setup();
  applyExerciseMove(left.simulation,left.character,'rotate','left');
  applyExerciseMove(right.simulation,right.character,'rotate','right');
  for(let i=0;i<15;i++){updateExerciseTurn(left.character,1/60);updateExerciseTurn(right.character,1/60);}
  assert.ok(left.character.rotation.y<-.2);assert.ok(right.character.rotation.y>.2);
  for(let i=0;i<240;i++)updateExerciseTurn(left.character,1/60);
  assert.ok(Math.abs(left.character.rotation.y)<.001);
});
