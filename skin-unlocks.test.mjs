import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSkinUnlockProgress} from './skin-unlocks.js';
const press=(p,s,t)=>{p.record(s,true,t);p.record(s,false,t);};
function setup(){let saved=null,time=0;const options={read:()=>saved,write:v=>saved=v,now:()=>time};return {p:createSkinUnlockProgress(options),options,advance:()=>time+=90001};}
test('only completed tasks award XP, held and invalid steps do not',()=>{
 const {p}=setup();press(p,'left',0);press(p,'right',1);assert.equal(p.state.xp,0);p.resetInput();p.tick();
 p.record('left',true,0);for(let i=1;i<30;i++)p.record('left',true,i*.2);p.record('left',false,6);
 press(p,'left',7);press(p,'right',20);assert.equal(p.state.task.current,0);
 for(let i=1;i<=11;i++)press(p,i%2?'left':'right',20+i*.5);
 assert.equal(p.state.xp,0);assert.equal(p.state.task.current,11);press(p,'right',26);
 assert.equal(p.state.xp,20);assert.equal(p.state.task,null);p.tick();assert.equal(p.state.task,null);
 for(let i=0;i<30;i++)press(p,i%2?'left':'right',27+i*.5);assert.equal(p.state.xp,20);
});
test('tasks persist across pages and rotate, rewards unlock placeholders at threshold',()=>{
 const {p,options,advance}=setup();let time=0;
 for(const target of [12,20,30,12]){
  p.tick();p.resetInput();press(p,'left',time++);
  for(let i=1;i<=target;i++)press(p,i%2?'right':'left',time++);
  assert.equal(p.state.task,null);const other=createSkinUnlockProgress(options);assert.equal(other.state.xp,p.state.xp);advance();
 }
 assert.equal(p.state.xp,110);assert.equal(p.slots[0].achieved,true);assert.equal(p.slots.length,1);
 assert.ok(p.slots.every(s=>s.placeholder));
});
test('partial task resumes and simultaneous inputs or pause reset cannot earn time',()=>{
 const {p,options}=setup();p.tick();press(p,'left',0);press(p,'right',.5);
 const other=createSkinUnlockProgress(options);assert.equal(other.state.task.current,1);
 press(other,'left',0);press(other,'right',0);other.resetInput();press(other,'left',1);assert.equal(other.state.task.current,1);
 press(other,'right',1.5);p.refresh();assert.equal(p.state.task.current,2);assert.equal(p.state.xp,0);
});
test('corrupt or unavailable storage does not award phantom experience',()=>{
 const p=createSkinUnlockProgress({read:()=>({xp:9999,completed:-3,task:{index:99}}),write:()=>{throw Error('unavailable');}});
 assert.equal(p.state.xp,0);p.tick();assert.equal(p.state.task.index,0);
});
