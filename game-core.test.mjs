import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WorkGame,HIT_WINDOW,PERFECT_WINDOW,ULTIMATE_HITS,ULTIMATE_STEPS} from './game-core.js';
const body=[{x:0,y:400,r:27},{x:0,y:650,r:27}];
function setup(){const g=new WorkGame(()=>.5);g.update(0,body);g.spawnAttack();g.spawnIn=100;return g;}
function advance(g,seconds){for(let t=0;t<seconds;t+=.01)g.update(.01,body);}
test('attacks only originate top left and right; exercise phrase includes all five actions',()=>{const g=setup(),edges=new Set(),actions=new Set();g.items=[];for(let i=0;i<30;i++){g.spawnAttack();const o=g.items.at(-1);edges.add(o.edge);actions.add(o.action);assert.ok(o.dy<=.3);assert.ok(o.hitAt>g.time);}assert.deepEqual([...edges].sort(),[0,1,3]);assert.equal(actions.size,5);});
test('object center reaches visible judgment circle at the scheduled time',()=>{const g=setup(),o=g.items[0];g.time=o.hitAt;g.update(0,body);assert.ok(Math.abs(Math.hypot(o.x-g.anchor.x,o.y-g.anchor.y)-g.ringRadius)<1e-8);});
test('correct action at line gives perfect and one deflection; cannot score twice',()=>{const g=setup(),o=g.items[0];g.time=o.hitAt;g.update(0,body);assert.ok(g.perform(o.action));assert.equal(g.score,20);assert.equal(g.combo,1);assert.equal(o.safe,true);assert.equal(g.perform(o.action),false);assert.equal(g.score,20);});
test('good window allows a little timing error, early input never pre-arms a block',()=>{const g=setup(),o=g.items[0];g.time=o.hitAt-.6;assert.equal(g.perform(o.action),false);assert.equal(o.safe,false);g.time=o.hitAt+PERFECT_WINDOW+.03;assert.ok(g.perform(o.action));assert.equal(g.score,10);});
test('wrong move fails the note even if followed by the right one; misses leak instead of instant death',()=>{const g=setup(),o=g.items[0];g.time=o.hitAt;assert.equal(g.perform('rotate'),false);assert.equal(o.failed,true);advance(g,.2);assert.equal(g.perform(o.action),false);advance(g,.6);assert.equal(g.air,72);assert.equal(g.over,false);});
test('doing nothing or holding a pedal does not block; passing window resets combo',()=>{const g=setup(),o=g.items[0];g.combo=3;g.set('left',true);g.time=o.hitAt+HIT_WINDOW+.01;g.update(0,body);assert.equal(o.failed,true);assert.equal(g.combo,0);assert.equal(o.safe,false);advance(g,.7);assert.equal(g.air,72);});
test('earned ultimate clears failed and upcoming notes without charging itself',()=>{const g=setup();g.ultimateHits=ULTIMATE_HITS;for(let i=0;i<ULTIMATE_STEPS;i++){g.set('left',false);g.set('left',true);advance(g,.2);}assert.ok(g.burst>0);assert.ok(g.items.every(o=>o.safe));assert.equal(g.ultimateHits,0);assert.equal(g.charge,0);});
test('repeated misses exhaust air and reset removes previous combo and notes',()=>{const g=setup();for(let i=0;i<4;i++){if(i){g.items=[];g.spawnAttack();g.spawnIn=100;}const o=g.items[0];g.time=o.hitAt+.7;g.invulnerable=0;g.update(0,body);}assert.equal(g.over,true);g.reset();assert.equal(g.air,100);assert.equal(g.combo,0);assert.equal(g.items.length,0);});

test('choreography requires the indicated foot and rotation is not a direction wildcard',()=>{
  const g=setup(),o=g.items[0];g.time=o.hitAt;
  assert.equal(g.perform(o.action,'right'),false);assert.equal(o.failed,true);
  const h=setup();h.items=[];h.attackIndex=4;h.spawnAttack();const turn=h.items[0];assert.equal(turn.action,'rotate');h.time=turn.hitAt;
  assert.equal(h.perform('up',turn.side),false);
  const j=setup();j.items=[];j.attackIndex=4;j.spawnAttack();j.time=j.items[0].hitAt;assert.equal(j.perform('rotate',j.items[0].side),true);
});
