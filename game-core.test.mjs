import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WorkGame,HIT_WINDOW,PERFECT_WINDOW,BARRAGE_STEPS,BARRAGE_WARNING,BARRAGE_DURATION,BARRAGE_INTERVAL} from './game-core.js';
const body=[{x:0,y:400,r:27},{x:0,y:650,r:27}];
function setup(){const g=new WorkGame(()=>.5);g.update(0,body);g.spawnAttack();g.spawnIn=100;g.nextBarrageAt=Infinity;return g;}
function advance(g,seconds){for(let t=0;t<seconds;t+=.01)g.update(.01,body);}
test('attacks only originate top left and right; exercise phrase includes all five actions',()=>{const g=setup(),edges=new Set(),actions=new Set();g.items=[];for(let i=0;i<30;i++){g.spawnAttack();const o=g.items.at(-1);edges.add(o.edge);actions.add(o.action);assert.ok(o.dy<=.3);assert.ok(o.hitAt>g.time);}assert.deepEqual([...edges].sort(),[0,1,3]);assert.equal(actions.size,5);});
test('each foot receives attacks from its own half, including overhead approaches',()=>{
  for(const random of [0,.5,1])for(const width of [150,600]){
    const g=new WorkGame(()=>random);g.nextBarrageAt=Infinity;g.setViewport(width);g.update(0,body);
    for(let i=0;i<30;i++){
      g.items=[];g.spawnAttack();g.spawnIn=100;const o=g.items[0],sign=o.side==='left'?-1:1;
      assert.ok((o.x-g.anchor.x)*sign>0);assert.ok(o.dx*sign>0);
      assert.ok(o.edge===0||o.edge===(o.side==='left'?3:1));
      g.time=o.hitAt;g.update(0,body);assert.ok((o.x-g.anchor.x)*sign>0);
    }
  }
});
test('beginner pacing provides time to read notes and a forgiving timing window',()=>{
  const g=setup();assert.equal(g.items[0].hitAt-g.time,3.6);assert.equal(g.beat,1.25);
  g.wave=100;assert.equal(g.beat,.9);
  for(const offset of [-.39,.39]){const h=setup(),o=h.items[0];h.time=o.hitAt+offset;assert.ok(h.perform(o.action,o.side));assert.equal(h.score,10);}
});
test('object center reaches visible judgment circle at the scheduled time',()=>{const g=setup(),o=g.items[0];g.time=o.hitAt;g.update(0,body);assert.ok(Math.abs(Math.hypot(o.x-g.anchor.x,o.y-g.anchor.y)-g.ringRadius)<1e-8);});
test('correct action at line gives perfect and one deflection; cannot score twice',()=>{const g=setup(),o=g.items[0];g.time=o.hitAt;g.update(0,body);assert.ok(g.perform(o.action));assert.equal(g.score,20);assert.equal(g.combo,1);assert.equal(o.safe,true);assert.equal(g.perform(o.action),false);assert.equal(g.score,20);});
test('resolved hazards disappear after blocking or hitting, including during damage immunity',()=>{
  const g=setup(),o=g.items[0];g.time=o.hitAt;assert.ok(g.perform(o.action,o.side));assert.equal(o.removed,true);
  g.update(0,body);assert.equal(g.items.length,0);assert.equal(g.events.filter(e=>e.type==='hit').length,1);
  for(const immune of [false,true]){
    const h=setup(),note=h.items[0];h.invulnerable=immune?1:0;h.time=note.hitAt+.7;h.update(0,body);
    assert.equal(h.items.length,0);assert.equal(note.removed,true);assert.equal(h.air,immune?100:72);
    advance(h,1);assert.equal(h.air,immune?100:72);
  }
});
test('good window allows a little timing error, early input never pre-arms a block',()=>{const g=setup(),o=g.items[0];g.time=o.hitAt-.6;assert.equal(g.perform(o.action),false);assert.equal(o.safe,false);g.time=o.hitAt+PERFECT_WINDOW+.03;assert.ok(g.perform(o.action));assert.equal(g.score,10);});
test('wrong move fails the note even if followed by the right one; misses leak instead of instant death',()=>{const g=setup(),o=g.items[0];g.time=o.hitAt;assert.equal(g.perform('rotate'),false);assert.equal(o.failed,true);advance(g,.2);assert.equal(g.perform(o.action),false);advance(g,.6);assert.equal(g.air,72);assert.equal(g.over,false);});
test('doing nothing or holding a pedal does not block; passing window resets combo',()=>{const g=setup(),o=g.items[0];g.combo=3;g.set('left',true);g.time=o.hitAt+HIT_WINDOW+.01;g.update(0,body);assert.equal(o.failed,true);assert.equal(g.combo,0);assert.equal(o.safe,false);advance(g,.7);assert.equal(g.air,72);});
test('practice mode survives exhausted air, allows recovery, and persists after reset',()=>{const g=setup();for(let i=0;i<6;i++){if(i){g.items=[];g.spawnAttack();g.spawnIn=100;}const o=g.items[0];g.time=o.hitAt+.7;g.invulnerable=0;g.update(0,body);}assert.equal(g.air,0);assert.equal(g.over,false);assert.equal(g.events.some(e=>e.type==='pop'),false);g.items=[];g.spawnAttack();const note=g.items[0];g.time=note.hitAt;assert.ok(g.perform(note.action,note.side));assert.equal(g.air,3);g.reset();assert.equal(g.air,100);assert.equal(g.combo,0);assert.equal(g.items.length,0);assert.equal(g.practiceMode,true);});

test('choreography requires the indicated foot and rotation is not a direction wildcard',()=>{
  const g=setup(),o=g.items[0];g.time=o.hitAt;
  assert.equal(g.perform(o.action,'right'),false);assert.equal(o.failed,true);
  const h=setup();h.items=[];h.attackIndex=4;h.spawnAttack();const turn=h.items[0];assert.equal(turn.action,'rotate');h.time=turn.hitAt;
  assert.equal(h.perform('up',turn.side),false);
  const j=setup();j.items=[];j.attackIndex=4;j.spawnAttack();j.time=j.items[0].hitAt;assert.equal(j.perform('rotate',j.items[0].side),true);
});

function rush(){const g=setup();g.startBarrage();g.time=g.barrage.rushAt;return g;}
function step(g,side){g.set(side,false);g.set(side,true);g.set(side,false);advance(g,.15);}
test('scheduled barrage warns first, replaces ordinary notes, and includes the cursor hazard',()=>{
  const g=setup();g.nextBarrageAt=18;g.time=18;g.update(0,body);
  assert.equal(g.barrageState,'warning');assert.equal(g.items.length,24);assert.ok(g.items.every(o=>o.barrage));
  assert.ok(g.items.some(o=>o.kind===4));assert.equal(g.nextNote,undefined);
  step(g,'left');assert.equal(g.charge,0);g.time=g.barrage.rushAt;g.update(0,body);assert.equal(g.barrageState,'active');
  const distance=Math.hypot(g.items[0].x-g.anchor.x,g.items[0].y-g.anchor.y);advance(g,1);
  assert.ok(Math.hypot(g.items[0].x-g.anchor.x,g.items[0].y-g.anchor.y)<distance);
});
test('normal blocking and stomping never earn a stockpiled ultimate',()=>{
  const g=setup(),note=g.items[0];g.time=note.hitAt;g.perform(note.action,note.side);
  for(let i=0;i<20;i++)step(g,i%2?'right':'left');
  assert.equal(g.charge,0);assert.equal(g.barrage,null);assert.equal(g.burst,0);
});
test('barrage resists normal directional blocks, held keys and single-foot spam',()=>{
  const g=rush();assert.equal(g.perform('up','left'),false);assert.equal(g.items.length,24);
  g.set('left',true);for(let i=0;i<20;i++){advance(g,.1);g.set('left',true);}assert.ok(g.charge<=1);
  for(let i=0;i<15;i++)step(g,'left');assert.ok(g.charge<=1);assert.equal(g.burst,0);assert.ok(g.barrage);
});
test('simultaneous pedals cannot create two beats in one frame',()=>{
  const g=rush();g.set('left',true);g.set('right',true);assert.equal(g.charge,1);
  advance(g,.2);g.set('right',true);assert.equal(g.charge,1);
  g.set('right',false);g.set('right',true);assert.equal(g.charge,2);
});
test('twelve alternating steps clear barrage and schedule recovery without recharging',()=>{
  const g=rush();g.air=40;
  for(let i=0;i<BARRAGE_STEPS;i++)step(g,i%2?'right':'left');
  assert.equal(g.barrage,null);assert.equal(g.items.length,0);assert.equal(g.charge,0);assert.ok(g.burst>0);
  assert.equal(g.air,60);assert.equal(g.score,240);assert.ok(g.nextBarrageAt>g.time+BARRAGE_INTERVAL-1);
  assert.equal(g.events.filter(e=>e.type==='burst').length,1);assert.deepEqual(g.feet,{left:false,right:false});
  advance(g,2);assert.ok(g.items.some(o=>!o.barrage));
});
test('stopping alternating pedals drains charge and a timed-out barrage leaks without killing practice player',()=>{
  const g=rush();step(g,'left');step(g,'right');const charged=g.charge;advance(g,2);assert.ok(g.charge<charged);
  g.air=20;g.time=g.barrage.endsAt;g.update(0,body);
  assert.equal(g.air,0);assert.equal(g.over,false);assert.equal(g.barrage,null);assert.equal(g.items.length,0);
  assert.equal(g.score,0);assert.ok(g.events.some(e=>e.type==='barrage-miss'));assert.equal(g.burst,0);
  g.reset();assert.equal(g.nextBarrageAt,18);assert.equal(g.barrage,null);assert.equal(g.charge,0);
});
test('barrage respects non-practice death and cannot charge past its deadline',()=>{
  const g=rush();g.practiceMode=false;g.air=1;g.time=g.barrage.endsAt;g.set('left',true);assert.equal(g.charge,0);
  g.update(0,body);assert.equal(g.over,true);assert.ok(g.events.some(e=>e.type==='pop'));
});
