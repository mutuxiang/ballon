import assert from 'node:assert/strict';
import {createDancer} from './model.mjs';
import {AirPhysics} from './physics.js';
const sim=new AirPhysics(createDancer({rest:true}).group);
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
assert.ok(heights.none<.5,'Deflation must settle on ground');
assert.ok(heights.high>4,'Air must recover an already collapsed body');
assert.ok(heights.low>heights.none,'Low air must supply some support');
console.log('Physics transition and stability checks passed',heights);
