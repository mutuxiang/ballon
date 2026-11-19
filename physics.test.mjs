import assert from 'node:assert/strict';
import {createDancer} from './model.mjs';
import {AirPhysics} from './physics.js';
import {Group,Vector3} from 'three';
import {SHOULDER_Y} from './arm-mesh.js';
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
    for(const arm of sim.arms){
      assert.ok(arm.nodes[0].p.distanceTo(sim.bodyPosition(arm.sign*.5,SHOULDER_Y,0))<1e-8,'Shoulder anchor must follow torso shrinkage');
    }
    if(i%300===0){
      sim.deform();
      for(const {mesh,rest} of sim.meshes.filter(o=>o.mesh.userData.armSign)){
        const out=mesh.geometry.attributes.position;
        for(let v=0;v<32;v++){
          const expected=sim.bodyPosition(rest[v*3],rest[v*3+1],rest[v*3+2]);expected.y=Math.max(.025,expected.y);
          assert.ok(expected.distanceTo(new Vector3().fromBufferAttribute(out,v))<1e-5,'Entire root ring must stay attached during deflation');
        }
        for(const value of out.array)assert.ok(Number.isFinite(value),'Arm deformation must remain finite');
      }
    }
  }
  sim.deform();heights[state]=sim.nodes[24].p.y;
}
assert.ok(heights.none<1.4,'Deflation must settle near ground');
assert.ok(heights.high>4,'Air must recover an already collapsed body');
assert.ok(heights.low>heights.none,'Low air must supply some support');
console.log('Physics transition and stability checks passed',heights);

const pet=new AirPhysics(createDancer({rest:true}).group,{planar:true});
for(const state of ['high','none','low']){pet.setState(state);for(let i=0;i<1800;i++)pet.step(1/120);for(const n of [...pet.nodes,...pet.arms.flatMap(a=>a.nodes)])assert.equal(n.p.z,0,'Desktop pet must stay in the front plane');}
console.log('Desktop pet planar motion checks passed');

const response=new AirPhysics(createDancer({rest:true}).group,{depthMotion:.32});response.setState('none');for(let i=0;i<1800;i++)response.step(1/120);response.setState('low');for(let i=0;i<72;i++)response.step(1/120);assert.ok(response.nodes[24].pressure>.5,'Single pedal should deliver air to head within 0.6 seconds');assert.equal(response.target,.72,'Quick response must retain half-air target');

const deflation=new AirPhysics(new Group(),{depthMotion:.32});
deflation.setState('none');
for(let i=0;i<60;i++)deflation.step(1/120);
assert.ok(deflation.nodes[0].pressure>.58,'The inlet must release air gradually');
assert.ok(deflation.nodes[24].pressure>.8,'The head must retain most of its air for the first half-second');
for(let i=60;i<180;i++)deflation.step(1/120);
assert.ok(deflation.nodes[24].pressure<.45,'The pressure must keep falling with the blower off');

for(const direction of [-1,1]){
  const baseline=new AirPhysics(new Group(),{depthMotion:.32});
  const dodging=new AirPhysics(new Group(),{depthMotion:.32});
  const stepBoth=()=>{baseline.step(1/120);dodging.step(1/120);};
  for(let i=0;i<240;i++)stepBoth();
  dodging.dodge(direction);
  for(let i=0;i<24;i++)stepBoth();
  const headOffset=()=>dodging.nodes[24].p.x-baseline.nodes[24].p.x;
  assert.ok(headOffset()*direction>.8,'The upper body must bend toward either side on cue');
  assert.deepEqual(dodging.nodes[0].p,baseline.nodes[0].p,'The base must stay planted');
  for(let i=24;i<60;i++)stepBoth();
  assert.ok(Math.abs(headOffset())<.5,'The body must return toward its usual sway');
}
