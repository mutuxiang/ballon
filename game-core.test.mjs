import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WorkGame,ULTIMATE_HITS,ULTIMATE_STEPS} from './game-core.js';
const body=[{x:0,y:400,r:27},{x:0,y:450,r:27}];
const item=(kind,x=0,y=368)=>({kind,x,y,vx:0,vy:0,r:18,angle:0,spin:0,safe:false});
function advance(g,seconds){for(let t=0;t<seconds;t+=.02)g.update(.02,body);}
function step(g,side='left'){g.set(side,false);g.set(side,true);advance(g,.2);}
test('hits leak air with grace period; only exhausted air ends run',()=>{const g=new WorkGame();g.spawnIn=100;g.items=[item(0),item(0)];g.update(.01,body);assert.equal(g.air,72);assert.equal(g.over,false);g.items=[item(0)];g.update(.01,body);assert.equal(g.air,72);for(let i=0;i<3;i++){g.invulnerable=0;g.items=[item(0)];g.update(.01,body);}assert.equal(g.air,0);assert.equal(g.over,true);});
test('two independent analog sticks support every quadrant and clamp magnitude',()=>{const g=new WorkGame();assert.equal(g.shields(body[0])[1].active,false);for(const [x,y] of [[1,0],[-1,0],[0,-1],[0,1],[.5,.5],[-.5,-.5]]){g.setStick('left',x,y);const s=g.shields(body[0])[0];assert.equal(s.x,x*220);assert.equal(s.y,400+y*220);}g.setStick('right',1,-1);assert.equal(g.sticks.left.x,-.5);assert.equal(g.sticks.right.enabled,true);assert.ok(Math.hypot(g.sticks.right.x,g.sticks.right.y)<=1.00001);g.setStick('left',NaN,0);assert.equal(g.sticks.left.x,-.5);});
test('movement pushes light objects; heavy objects need a fresh press',()=>{const g=new WorkGame();g.spawnIn=100;g.setStick('left',0,-.6);const s=g.shields(body[0])[0];g.items=[item(0,s.x,s.y)];g.update(.01,body);assert.equal(g.items[0].safe,true);g.items=[item(1,s.x,s.y)];g.update(.01,body);assert.equal(g.items[0].safe,false);g.set('left',true);g.update(.01,body);assert.equal(g.items[0].safe,true);advance(g,.4);g.items=[item(3,s.x,s.y)];g.update(.01,body);assert.equal(g.items[0].safe,false);g.set('left',false);g.set('left',true);g.update(.01,body);assert.equal(g.items[0].safe,true);});
test('deflection follows full 360 degree direction and disabled controller does not block',()=>{for(const [x,y] of [[1,0],[-1,0],[0,-1],[0,1]]){const g=new WorkGame();g.spawnIn=100;g.setStick('left',x,y);const s=g.shields(body[0])[0],o=item(0,s.x,s.y);g.items=[o];g.update(.01,body);assert.ok(o.safe);assert.equal(Math.sign(o.vx),x);assert.equal(Math.sign(o.vy),y);}const g=new WorkGame();const s=g.shields(body[0])[1];g.items=[item(0,s.x,s.y)];g.update(.01,body);assert.equal(g.items[0].safe,false);});
test('ultimate requires earned hits, accepts repeated same-foot steps, clears once without farming next ultimate',()=>{const g=new WorkGame();g.spawnIn=100;for(let i=0;i<10;i++)step(g);assert.equal(g.charge,0);assert.equal(g.burst,0);for(let i=0;i<ULTIMATE_HITS;i++)g.deflect(item(0,200,0),{x:1,y:0});assert.ok(g.ultimateReady);g.items=[item(3,300,-100),item(1,-300,-100)];for(let i=0;i<ULTIMATE_STEPS-1;i++)step(g);assert.equal(g.burst,0);assert.equal(g.charge,ULTIMATE_STEPS-1);g.set('left',true);assert.equal(g.charge,ULTIMATE_STEPS-1);step(g);assert.ok(g.burst>0);assert.ok(g.items.every(o=>o.safe));assert.equal(g.ultimateHits,0);assert.equal(g.charge,0);assert.equal(g.events.filter(e=>e.type==='burst').length,1);});
test('charge decays but earned unlock persists; reset and disabled input clear correctly',()=>{const g=new WorkGame();g.spawnIn=100;g.ultimateHits=ULTIMATE_HITS;step(g);advance(g,3);assert.ok(g.charge<1);assert.ok(g.ultimateReady);g.setStick('left',0,-1,false);g.set('left',true);assert.equal(g.feet.left,false);g.reset();assert.equal(g.air,100);assert.equal(g.ultimateHits,0);assert.equal(g.sticks.right.enabled,false);});

test('four-edge patterns point at the character, warn first, and vary attack rhythm',()=>{
  const g=new WorkGame(()=>.5);g.setViewport(500);g.spawnIn=100;
  const edges=new Set(),counts=[];
  for(let n=0;n<6;n++){
    g.items=[];g.spawnAttack(body);counts.push(g.items.length);
    for(const o of g.items){
      edges.add(o.edge);assert.ok(o.warning>=.75);
      const target=body[0],to={x:target.x-o.x,y:target.y-o.y};
      assert.ok(o.vx*to.x+o.vy*to.y>0,'must travel inward toward body');
      assert.ok(Math.abs(Math.atan2(o.vy,o.vx)-(o.angle+Math.PI/2))<1e-8);
    }
    const first=g.items[0],old={x:first.x,y:first.y};g.update(.02,body);
    assert.equal(first.x,old.x);assert.equal(first.y,old.y);
  }
  assert.deepEqual([...edges].sort(),[0,1,2,3]);assert.deepEqual(counts,[1,2,3,1,2,3]);
});
test('rotated sharp tips hit from left, right, above and below',()=>{
  for(const [x,y,vx,vy] of [[-50,400,100,0],[50,400,-100,0],[0,350,0,100],[0,500,0,-100]]){
    const g=new WorkGame();g.spawnIn=100;g.setStick('left',0,0,false);
    g.items=[{...item(1,x,y),vx,vy}];g.update(.01,body);assert.equal(g.air,72);
  }
});
test('pending attack is cleared by ultimate and does not reappear',()=>{
  const g=new WorkGame(()=>.5);g.spawnIn=100;g.spawnAttack(body);g.spawnIn=100;
  g.ultimateHits=ULTIMATE_HITS;
  // Park telegraphed threats far away while charging.
  for(const o of g.items)o.warning=10;
  for(let i=0;i<ULTIMATE_STEPS;i++)step(g);
  assert.ok(g.items.every(o=>o.safe&&o.warning===0));assert.equal(g.ultimateHits,0);
});
