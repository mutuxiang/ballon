import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDancer} from './model.mjs';
import {createClothing} from './clothing.js';
import {createSkinGradient,MAX_HEAD_HEIGHT} from './skin-gradient.js';

test('shared desktop complexion follows head height and restores skin and hands on recovery',()=>{
  const character=createDancer({rest:true,separateFace:true}).group;
  const clothing=createClothing(character);clothing.select('pastel');
  let transparentFace=false;
  const gradient=createSkinGradient(character,{setSurfaceGradient:value=>{transparentFace=value;}});
  gradient.setEnabled(true);assert.equal(transparentFace,true);
  const skin=character.getObjectByName('Skin'),arm=character.getObjectByName('Arm_left');
  const highSkin=Array.from(skin.geometry.attributes.color.array),highArm=Array.from(arm.geometry.attributes.color.array);
  const simulation={nodes:Array.from({length:25},()=>({p:{y:MAX_HEAD_HEIGHT}}))};
  simulation.nodes[24].p.y=.5;gradient.update(simulation);
  assert.ok(gradient.strength>.9);assert.ok(gradient.range>4);
  assert.notDeepEqual(Array.from(skin.geometry.attributes.color.array),highSkin);
  assert.notDeepEqual(Array.from(arm.geometry.attributes.color.array),highArm);
  simulation.nodes[24].p.y=MAX_HEAD_HEIGHT;gradient.update(simulation);
  assert.equal(gradient.strength,0);assert.deepEqual(Array.from(skin.geometry.attributes.color.array),highSkin);
  assert.deepEqual(Array.from(arm.geometry.attributes.color.array),highArm);
});
