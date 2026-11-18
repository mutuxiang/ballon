import assert from 'node:assert/strict';
import {classifyMotion,createMotionExpressions,MIN_EXPRESSION_HOLD} from './motion-expressions.js';
import {createDancer} from './model.mjs';
import {AirPhysics} from './physics.js';

const base={height:5.4,pressure:1,target:1,speed:0,verticalSpeed:0,lean:0};
const cases=[
  [{height:.4},'narrow'],
  [{target:0,verticalSpeed:-1},'pout'],
  [{pressure:.5},'sparkle'],
  [{lean:1},'sleepy-grin'],
  [{speed:1.5,lean:.4},'sparkle-grin'],
  [{verticalSpeed:.3},'smile'],
  [{speed:.5},'chill'],
  [{},'confident']
];
for(const [overrides,expected] of cases)assert.equal(classifyMotion({...base,...overrides}).skin,expected);
assert.equal(new Set(cases.map(([overrides])=>classifyMotion({...base,...overrides}).skin)).size,8);

const fake={nodes:Array.from({length:25},(_,i)=>({p:{x:0,y:i===0?.64:5.4,z:0},pressure:1})),target:1};
const events=[];const controller=createMotionExpressions(skin=>events.push(skin));
controller.setEnabled(true,fake);assert.equal(controller.skin,'confident');
fake.nodes[24].p.y=.4;
for(let i=0;i<20;i++)controller.update(0,fake);
assert.equal(events.length,1,'Pause must freeze state changes');
for(let i=0;i<8;i++)controller.update(.1,fake);
assert.equal(events.length,1,'Minimum dwell must be respected');
controller.update(.1,fake);assert.equal(controller.skin,'narrow');
controller.setEnabled(false,fake);fake.nodes[24].p.y=5.4;
for(let i=0;i<20;i++)controller.update(.1,fake);
assert.equal(events.length,2,'Disabled mode must not change a manual expression');

const simulation=new AirPhysics(createDancer({rest:true}).group,{seed:28713});
let elapsed=0;const liveEvents=[];
const live=createMotionExpressions((skin,reason)=>liveEvents.push({skin,reason,time:elapsed}));
live.setEnabled(true,simulation);
for(const state of ['high','none','high','low','high']){
  simulation.setState(state);
  for(let i=0;i<1200;i++){simulation.step(1/120);elapsed+=1/120;live.update(1/120,simulation);}
}
assert.ok(liveEvents.every(event=>event.skin!=='original'));
assert.ok(new Set(liveEvents.map(event=>event.skin)).size>=4,'Actual air/motion transitions must produce varied expressions');
for(let i=1;i<liveEvents.length;i++)assert.ok(liveEvents[i].time-liveEvents[i-1].time>=MIN_EXPRESSION_HOLD-.00001,'Live switches must not flicker');
console.log('Motion expression checks passed',JSON.stringify(liveEvents));
