import assert from 'node:assert/strict';
import {createDancer} from './model.mjs';
import {AirPhysics} from './physics.js';
import {Vector3} from 'three';
const sim=new AirPhysics(createDancer({rest:true}).group);
const contact={p:new Vector3(.5,.05,0)};
sim.repelSegment(contact,{p:new Vector3(0,0,0)},{p:new Vector3(1,0,0)},.4);
assert.ok(contact.p.y>=.3999,'Contacts between solver nodes must be separated');
const outside={p:new Vector3(.5,1,0)};
sim.repelSegment(outside,{p:new Vector3(0,0,0)},{p:new Vector3(1,0,0)},.4);
assert.equal(outside.p.y,1,'Separated surfaces must not be pulled together');
const heights={};
for(const state of ['high','none','low','high']){
  const before=sim.nodes[24].p.clone();sim.setState(state);
  assert.equal(before.distanceTo(sim.nodes[24].p),0,'Switching air must not teleport geometry');
  for(let i=0;i<1800;i++){
    sim.step(1/120);
    for(const n of sim.nodes){assert.ok(Number.isFinite(n.p.length()));assert.ok(n.p.y>=0);}
    assert.equal(sim.nodes[0].p.y,.64);
  }
  sim.deform();heights[state]=sim.nodes[24].p.y;
}
assert.ok(heights.none<1.4,'Deflation must settle near ground');
assert.ok(heights.high>4,'Air must recover an already collapsed body');
assert.ok(heights.low>heights.none,'Low air must supply some support');
console.log('Physics transition and stability checks passed',heights);
