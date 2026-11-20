import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {AirPhysics} from './physics.js';
import {OutlineCollider,extractVesselOutline,SpriteProjection,SpriteVesselPhysics,VESSELS} from './sprite-collision.js';

test('alpha contours exclude detached noise, cup handles, glass contents and the opening',()=>{
  const pixels=new Uint8ClampedArray(100*100*4);
  for(let y=0;y<100;y++)for(let x=12;x<78;x++)pixels[(y*100+x)*4+3]=255;
  for(let y=20;y<70;y++)for(let x=86;x<98;x++)pixels[(y*100+x)*4+3]=255;
  const points=extractVesselOutline(pixels,100,{x:0,y:0,width:100,height:100},'cup');
  assert.ok(points.every(([x])=>x<.8),'a handle cannot expand the cavity');
  const collider=new OutlineCollider(points,4.8,3.5);
  assert.equal(collider.move({x:-.4,y:3},{x:-.4,y:0},.2).hit,false,'open top and interior are empty');
  for(let y=0;y<100;y++)for(let x=18;x<72;x++)pixels[(y*100+x)*4+3]=0;
  const glass=extractVesselOutline(pixels,100,{x:0,y:0,width:100,height:100},'bowl');
  assert.equal(glass.length,21,'transparent glass still uses measured alpha edges');
});

test('swept contacts stop fast crossings on both sides and support the rim',()=>{
  const c=new OutlineCollider(VESSELS.bowl.outline,4.6,3.8);
  const inside=c.move({x:0,y:0},{x:4,y:0},.4);assert.ok(inside.hit&&inside.x<2);
  const outside=c.move({x:4,y:0},{x:0,y:0},.4);assert.ok(outside.hit&&outside.x>2);
  const rim=c.move({x:1.52,y:3},{x:1.52,y:0},.4);assert.ok(rim.hit&&rim.y>1.8);
  assert.equal(c.move({x:0,y:3},{x:0,y:0},.4).hit,false);
  const bottom=c.move({x:0,y:0},{x:0,y:-3},.3);assert.ok(bottom.hit&&bottom.y> -1.5);
});

test('screen projection agrees with the rendered sprite through orbit, scale and perspective',()=>{
  for(const camera of [new T.OrthographicCamera(-7,7,5,-5,.1,100),new T.PerspectiveCamera(37,1.7,.1,100)]){
    camera.position.set(4,5,14);camera.lookAt(0,2,0);camera.updateMatrixWorld();
    const character=new T.Group();character.position.set(.2,.1,0);character.rotation.y=.6;character.scale.setScalar(.8);
    character.updateMatrixWorld();const center=character.localToWorld(new T.Vector3(0,1.65,0)),map=new SpriteProjection(character,camera,center),point=new T.Vector3(.8,3,.5);
    const projected=map.project(point);assert.ok(map.unproject(projected,projected.z).distanceTo(point)<1e-10);
    const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion);
    const onSprite=center.clone().addScaledVector(right,projected.x).addScaledVector(up,projected.y).project(camera);
    const onBody=character.localToWorld(point.clone()).project(camera);
    assert.ok(Math.abs(onSprite.x-onBody.x)<1e-10&&Math.abs(onSprite.y-onBody.y)<1e-10);
  }
});

// Alpha-sampled break-skin-atlas-v1.png bowl, at the current rendered size.
// The old smaller analytic outline did not reproduce folded-body trapping.
const BOWL_OUTLINE=[[.17,.105],[.1430811808118081,.195],[.08404059040590406,.286875],[.04714022140221402,.37875],[.028690036900368976,.470625],[.025,.5625],[.03238007380073793,.654375],[.05821033210332105,.74625],[.10618081180811811,.838125],[.20950184501845015,.93],[.5,.955],[.7831180811808118,.93],[.8827490774907749,.838125],[.9344095940959409,.74625],[.956549815498155,.654375],[.967619926199262,.5625],[.963929889298893,.470625],[.9454797047970479,.37875],[.9122693726937269,.286875],[.8532287822878228,.195],[.83,.105]];
function setup(kind,perspective=false,seed=23){
  const character=new T.Group(),camera=perspective?new T.PerspectiveCamera(37,1.5,.1,100):new T.OrthographicCamera(-7,7,4,-4,.1,100);
  camera.position.set(perspective?2.4:0,perspective?4.5:3.2,14.3);camera.lookAt(perspective?.4:0,perspective?2.7:3.2,0);camera.updateMatrixWorld();
  const center=new T.Vector3(kind==='bowl'?0:.4,kind==='bowl'?1.75:1.65,0),collider=new OutlineCollider(kind==='bowl'?BOWL_OUTLINE:VESSELS[kind].outline,kind==='bowl'?5.4:4.85,kind==='bowl'?4.622878228782288:3.5);
  const environment=new SpriteVesselPhysics(character,camera,()=>({center,collider})),sim=new AirPhysics(character,{seed,depthMotion:perspective?1:.32});sim.environment=environment;
  return {sim,environment,map:()=>new SpriteProjection(character,camera,center),collider};
}

test('body and hands stay outside the wall band during deflation, recovery and mouse dodges',()=>{
  for(const kind of ['bowl','cup'])for(const perspective of [false,true]){
    const {sim,environment,map,collider}=setup(kind,perspective);let maxPenetration=0;
    for(let i=0;i<1800;i++){
      if(i===240)sim.setState('none');if(i===1000)sim.setState('high');if(i===1400)sim.dodge(1);if(i===1600)sim.dodge(-1);
      sim.step(1/120);const projection=map();
      const nodes=[...sim.nodes.slice(2).map(n=>[n,sim.bodyRadius(n)]),...sim.arms.flatMap(a=>a.nodes.slice(1).map(n=>[n,.12+.12*n.pressure]))];
      for(const [n,r] of nodes){const p=projection.project(n.p);maxPenetration=Math.max(maxPenetration,r*p.factor-collider.distance(p));assert.ok(n.p.toArray().every(Number.isFinite)&&n.p.length()<12);}
    }
    assert.ok(environment.contacts>0);assert.ok(maxPenetration<.015,`${kind} visible penetration: ${maxPenetration}`);
    assert.ok(sim.nodes.at(-1).p.y>3.5,'reinflation must be able to exit the open top');
  }
});

test('actual fishbowl settles completely and wakes smoothly through repeated inflation cycles',()=>{
  for(const perspective of [false,true])for(const seed of [23,513,9121,2026]){
    const {sim,environment,map,collider}=setup('bowl',perspective,seed);
    const all=()=>[...sim.nodes,...sim.arms.flatMap(a=>a.nodes)];
    for(let i=0;i<240;i++)sim.step(1/120);
    for(const state of ['high','low']){
      sim.setState('none');for(let i=0;i<1800;i++)sim.step(1/120);
      assert.equal(environment.sleeping,true,`seed ${seed}: empty pet must sleep`);
      assert.ok(sim.nodes[24].p.y<4.5,'sleep must follow collapse or rim support, not freeze an upright pet');
      const resting=all().map(n=>n.p.clone()),contacts=environment.contacts;
      for(let i=0;i<240;i++)sim.step(1/120);
      all().forEach((n,i)=>assert.ok(n.p.distanceTo(resting[i])<1e-12,'body AND arms must stay still'));
      assert.equal(environment.contacts,contacts,'sleeping contacts must not keep resolving');
      assert.equal(environment.nudge(sim,1),false,'mouse/demo nudges cannot restart empty-body jitter');
      sim.setState(state);let recovered=false,maxPenetration=0;
      for(let i=0;i<1200;i++){
        const before=sim.nodes.map(n=>n.p.clone());sim.step(1/120);
        assert.equal(environment.sleeping,false);
        sim.nodes.slice(2).forEach((n,j)=>assert.ok(n.p.distanceTo(before[j+2])<.06,'wake-up must not snap the body upright'));
        const projection=map();
        for(const n of sim.nodes.slice(2)){const p=projection.project(n.p);maxPenetration=Math.max(maxPenetration,sim.bodyRadius(n)*p.factor-collider.distance(p));}
        if(sim.nodes[24].p.y>4.9)recovered=true;
      }
      assert.ok(recovered,`seed ${seed}: ${state} inflation must stand through the opening`);
      assert.ok(maxPenetration<.015,'recovery must retain vessel contacts');
    }
  }
});

test('contacts are fixed-step and independent of display refresh rate',()=>{
  const a=setup('bowl'),b=setup('bowl');a.sim.setState('none');b.sim.setState('none');
  for(let i=0;i<120;i++)a.sim.update(1/60);for(let i=0;i<240;i++)b.sim.update(1/120);
  a.sim.nodes.forEach((n,i)=>assert.ok(n.p.distanceTo(b.sim.nodes[i].p)<1e-9));
});

test('repeated rim contacts do not teleport sections or keep a deflated body jittering',()=>{
  for(const kind of ['bowl','cup']){
    const {sim,environment}=setup(kind,true);let peak=0,rest=0;
    for(let i=0;i<3000;i++){
      if(i===180)sim.setState('none');if(i===1800)sim.setState('high');
      if(i>1900&&i%100===0)environment.nudge(sim,i%200?-1:1);
      const previous=sim.nodes.map(n=>n.p.clone());sim.step(1/120);
      sim.nodes.slice(2).forEach((n,j)=>{const d=n.p.distanceTo(previous[j+2]);if(i>5)peak=Math.max(peak,d);if(i>1400&&i<1800)rest=Math.max(rest,d);});
    }
    assert.ok(peak<.06,`${kind}: a contact moved a section ${peak} in one step`);
    assert.ok(rest<.006,`${kind}: resting sections still jitter by ${rest}`);
  }
});
