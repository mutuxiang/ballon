import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createDancer} from './model.mjs';
import {AirPhysics} from './physics.js';
import {createThemeSkins,placeContainerLayer} from './theme-skins.js';

test('wind keeps the original kite enlarged and removes leaves and wind strokes',()=>{
  const character=createDancer({rest:true,separateFace:true}).group,scene=new THREE.Scene();scene.add(character);
  const camera=new THREE.OrthographicCamera(-8,8,7,-.5,.1,100);camera.position.z=15;camera.updateMatrixWorld();
  const themes=createThemeSkins(scene,character,camera,{loadTexture:()=>new THREE.Texture()});
  themes.select('wind');themes.update(0,new AirPhysics(character,{seed:23}));
  assert.equal(scene.getObjectByName('Theme_cell_wind_7'),undefined);
  assert.equal(scene.getObjectByName('Theme_cell_wind_8'),undefined);
  const kite=scene.getObjectByName('Theme_cell_wind_1');
  assert.equal(kite.scale.y,1.95);assert.ok(scene.getObjectByName('Theme_kite_string'));
  themes.dispose();
});

test('themes leave character geometry, physics, expression and outfit untouched and clear cleanly',()=>{
  const character=createDancer({rest:true,separateFace:true}).group;
  const scene=new THREE.Scene();scene.add(character);
  const camera=new THREE.PerspectiveCamera(37,1,.1,100);camera.position.z=15;camera.updateMatrixWorld();
  const simulation=new AirPhysics(character,{seed:23});
  const vertices=[];character.traverse(mesh=>{if(mesh.isMesh)vertices.push([mesh,mesh.geometry.attributes.position.array.slice()]);});
  const positions=simulation.nodes.map(node=>node.p.clone());
  const children=[...character.children],userData=structuredClone(character.userData);
  const themes=createThemeSkins(scene,character,camera,{loadTexture:()=>new THREE.Texture()});
  for(const id of ['fishing','breathe','fresh','tea','wind']){
    assert.equal(themes.select(id),true);themes.update(.016,simulation);
    const visible=scene.getObjectByName('Theme_accessories').children.filter(group=>group.visible);
    assert.equal(visible.length,1);assert.equal(visible[0].name,'Theme_'+id);
    for(const sprite of visible[0].children){
      assert.ok(sprite.position.toArray().every(Number.isFinite));assert.equal(sprite.layers.mask,1);
      if(sprite.isLine){assert.ok(sprite.geometry.attributes.position.array.every(Number.isFinite));continue;}
      const mask=sprite.children[0];assert.equal(mask.layers.mask,2);assert.equal(mask.material.allowOverride,false);
      assert.equal(mask.material.map,sprite.material.map);assert.equal(mask.material.color.getHex(),0);
    }
  }
  assert.deepEqual(character.children,children);assert.deepEqual(character.userData,userData);
  for(const [mesh,original] of vertices)assert.deepEqual(mesh.geometry.attributes.position.array,original);
  assert.deepEqual(simulation.nodes.map(node=>node.p),positions);
  assert.equal(themes.select('unknown'),false);assert.equal(themes.active,'wind');
  themes.select('none');assert.ok(scene.getObjectByName('Theme_accessories').children.every(group=>!group.visible));
  themes.dispose();themes.dispose();assert.equal(scene.getObjectByName('Theme_accessories'),undefined);
});

test('wearables follow physical body and hand positions, while paused decorations freeze',()=>{
  const character=createDancer({rest:true,separateFace:true}).group,scene=new THREE.Scene();scene.add(character);
  const camera=new THREE.PerspectiveCamera(37,1,.1,100);camera.position.z=15;camera.updateMatrixWorld();
  const simulation=new AirPhysics(character,{seed:23});
  const themes=createThemeSkins(scene,character,camera,{loadTexture:()=>new THREE.Texture()});
  themes.select('fishing');themes.update(.1,simulation);
  const goggles=scene.getObjectByName('Theme_cell_1'),bubbles=scene.getObjectByName('Theme_cell_2');
  const oldGoggles=goggles.position.clone(),oldBubbles=bubbles.position.clone();
  themes.update(0,simulation);assert.deepEqual(bubbles.position,oldBubbles);
  for(const node of simulation.nodes)node.p.x+=.4;
  themes.update(0,simulation);assert.ok(goggles.position.distanceTo(oldGoggles)>.3);
  themes.select('fresh');themes.update(0,simulation);
  const fan=scene.getObjectByName('Theme_cell_8'),oldFan=fan.position.clone();
  simulation.arms[1].nodes.at(-1).p.y+=.5;
  themes.update(0,simulation);assert.ok(Math.abs(fan.position.y-oldFan.y-.5)<1e-6);
  themes.dispose();
});

test('container layers bracket the character while staying aligned in perspective and orthographic views',()=>{
  for(const camera of [new THREE.PerspectiveCamera(37,1.4,.1,100),new THREE.OrthographicCamera(-6,6,5,-5,.1,100)]){
    camera.position.set(3,4,14);camera.lookAt(0,2.5,0);camera.updateMatrixWorld();
    const center=new THREE.Vector3(.4,1.68,0),size=new THREE.Vector2(4.85,3.5);
    const rear=new THREE.Sprite(),front=new THREE.Sprite();
    placeContainerLayer(rear,center,size,camera,-1.3);placeContainerLayer(front,center,size,camera,1.3);
    const a=rear.position.clone().project(camera),b=front.position.clone().project(camera),c=center.clone().project(camera);
    assert.ok(Math.abs(a.x-b.x)<1e-10&&Math.abs(a.y-b.y)<1e-10);
    assert.ok(b.z<c.z&&c.z<a.z,'front wall, character, rear rim must appear in that depth order');
    const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
    const edgeA=rear.position.clone().addScaledVector(right,rear.scale.x/2).project(camera);
    const edgeB=front.position.clone().addScaledVector(right,front.scale.x/2).project(camera);
    assert.ok(Math.abs(edgeA.x-edgeB.x)<1e-10,'front and rear artwork must not separate when viewed in perspective');
  }
});

test('wearable layers share their attachment pivot and bag follows the forearm',()=>{
  const character=createDancer({rest:true,separateFace:true}).group,scene=new THREE.Scene();scene.add(character);
  const camera=new THREE.PerspectiveCamera(37,1,.1,100);camera.position.set(2,4,14);camera.lookAt(0,3,0);camera.updateMatrixWorld();
  const simulation=new AirPhysics(character,{seed:23}),themes=createThemeSkins(scene,character,camera,{loadTexture:()=>new THREE.Texture()});
  themes.select('wind');themes.update(0,simulation);
  for(const cell of ['scarf',5]){
    const a=scene.getObjectByName(`Theme_cell_wind_${cell}_rear`),b=scene.getObjectByName(`Theme_cell_wind_${cell}_front`);
    const pa=a.position.clone().project(camera),pb=b.position.clone().project(camera);
    assert.ok(Math.hypot(pa.x-pb.x,pa.y-pb.y)<1e-10);assert.deepEqual(a.center,b.center);
  }
  const bag=scene.getObjectByName('Theme_cell_wind_5_front'),before=bag.position.clone();
  simulation.arms[0].nodes[4].p.y+=.5;themes.update(0,simulation);assert.ok(bag.position.distanceTo(before)>.4);
  themes.select('fishing');assert.equal(scene.getObjectByName('Theme_fishing').getObjectByName('Theme_cell_3'),undefined);
  themes.dispose();
});

test('scarf tail stays joined to its collar through bending, deflation and camera changes',()=>{
  const character=createDancer({rest:true,separateFace:true}).group,scene=new THREE.Scene();scene.add(character);
  const simulation=new AirPhysics(character,{seed:23});
  for(const camera of [new THREE.PerspectiveCamera(37,1.4,.1,100),new THREE.OrthographicCamera(-6,6,5,-5,.1,100)]){
    camera.position.set(2,4,14);camera.lookAt(0,3,0);camera.updateMatrixWorld();
    const themes=createThemeSkins(scene,character,camera,{loadTexture:()=>new THREE.Texture()});themes.select('wind');
    for(const pressure of [1,.4,0])for(const lean of [0,.8,-1.2]){
      for(const [i,node] of simulation.nodes.entries()){node.pressure=pressure;node.p.set(lean*i/24,.64+i*4.9/24,0);}
      themes.update(.016,simulation);
      const collar=scene.getObjectByName('Theme_cell_wind_scarf_front'),tail=scene.getObjectByName('Theme_cell_wind_4');
      const rotation=collar.material.rotation,dx=(.09-collar.center.x)*collar.scale.x,dy=(1-.56-collar.center.y)*collar.scale.y;
      const seam=collar.position.clone().add(new THREE.Vector3(dx*Math.cos(rotation)-dy*Math.sin(rotation),dx*Math.sin(rotation)+dy*Math.cos(rotation),0).applyQuaternion(camera.quaternion)).project(camera);
      const anchor=tail.position.clone().project(camera);
      assert.ok(Math.hypot(seam.x-anchor.x,seam.y-anchor.y)<1e-9,'tail pivot must remain at the same visible stitch point');
      assert.ok(Math.abs(tail.material.rotation-rotation)<=.025,'tail rotates with the neck, with only a small flutter');
      assert.equal(collar.material.depthTest,false,'folding must not hide the front collar');
    }
    themes.dispose();
  }
});
