import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {samplePhotoColors,rgbToHsl,normalizeAppearance,localDay,APPEARANCE_KEY,DEFAULT_SKIN} from './today-palette.js';
import {createTodayAppearance,mountStoredAppearance} from './today-appearance.js';
import {createDancer} from './model.mjs';
const appearance={version:2,day:localDay(),colors:{skin:'#deb08c',hair:'#4d2c24',outer:'#286cc1',inner:'#e9c3a1',trousers:'#244366'}};
const rgb=hex=>hex.slice(1).match(/../g).map(c=>parseInt(c,16));
function fixture(outer,inner=outer){const width=100,height=100,data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const color=y<25?[77,44,36]:y<60?[222,176,140]:x>=45&&x<55?inner:outer;data.set([...color,255],(y*width+x)*4);
}return {data,width,height};}
test('outer and inner clothing keep separate hue families, including dark and neutral clothes',()=>{
  for(const source of [[180,40,30],[30,100,210],[35,145,80],[145,65,190],[220,165,30],[30,30,30],[245,245,245]]){
    const colors=samplePhotoColors(fixture(source,[230,210,185])),actual=rgb(colors.outer);
    const before=rgbToHsl(source),after=rgbToHsl(actual),distance=Math.abs(before[0]-after[0]);
    if(before[1]>.1)assert.ok(Math.min(distance,1-distance)*360<2,'hue remains within 2 degrees after rounding');
    else assert.ok(Math.max(...actual)-Math.min(...actual)<2,'neutral fabric remains neutral');
    assert.ok(Math.abs(before[1]-after[1])<.025,'saturation is preserved');
    assert.notEqual(colors.outer,colors.inner);
  }
  const colors=samplePhotoColors(fixture([30,100,210],[210,50,40]));
  assert.ok(rgb(colors.outer)[2]>rgb(colors.outer)[0]);assert.ok(rgb(colors.inner)[0]>rgb(colors.inner)[2]);
});
test('dominant family wins over a differently colored minority rather than averaging colors',()=>{
  const photo=fixture([30,100,210]);
  for(let y=64;y<70;y++)for(let x=28;x<43;x++)photo.data.set([220,40,40,255],(y*100+x)*4);
  const colors=samplePhotoColors(photo);assert.ok(rgb(colors.outer)[2]>rgb(colors.outer)[0]*3);
});
test('schema strips photos and migrates old palettes without losing their shirt color',()=>{
  assert.deepEqual(normalizeAppearance({...appearance,photo:'private',style:'tie'}),appearance);
  assert.equal(normalizeAppearance({...appearance,colors:{...appearance.colors,inner:'url(secret)'}}),null);
  const legacy=normalizeAppearance({version:1,day:localDay(),colors:{skin:'#deb08c',hair:'#4d2c24',shirt:'#286cc1',trousers:'#244366'},style:'tie'});
  assert.equal(legacy.version,2);assert.equal(legacy.colors.outer,'#286cc1');assert.equal(legacy.colors.inner,'#286cc1');assert.equal(legacy.style,undefined);
  assert.throws(()=>samplePhotoColors({width:1,height:1,data:[]}));
});
test('face uses the chosen light warm default regardless of camera lighting',()=>{
  const photo=fixture([30,100,210]);
  for(let y=25;y<47;y++)for(let x=37;x<63;x++)photo.data.set(x<46?[22,22,25,255]:[150,105,80,255],(y*100+x)*4);
  assert.equal(samplePhotoColors(photo).skin,DEFAULT_SKIN);
  for(let i=0;i<photo.data.length;i+=4)photo.data.set([0,0,0,255],i);
  assert.equal(samplePhotoColors(photo).skin,DEFAULT_SKIN);
  assert.equal(normalizeAppearance({...appearance,colors:{...appearance.colors,skin:'#b98a69'}}).colors.skin,'#b98a69','manual skin choice is preserved');
});
test('body center and sleeves use independent colors and reset restores original geometry and face',()=>{
  const character=createDancer({rest:true,separateFace:true}).group;
  const skins={setSurfaceGradient(){},setPalette(value){this.palette=value;}};
  const shirt=character.getObjectByName('Shirt'),original=shirt.material.color.getHexString();
  const controller=createTodayAppearance(character,skins);controller.apply(appearance);
  const positions=shirt.geometry.attributes.position,colors=shirt.geometry.attributes.color;
  const inner=new THREE.Color(appearance.colors.inner),outer=new THREE.Color(appearance.colors.outer);
  let foundInner=false,foundOuter=false;
  for(let i=0;i<positions.count;i++){
    if(positions.getZ(i)>.5&&Math.abs(positions.getX(i))<.1){assert.ok(Math.abs(colors.getX(i)-inner.r)<1e-5);foundInner=true;}
    if(positions.getZ(i)<-.5){assert.ok(Math.abs(colors.getX(i)-outer.r)<1e-5);foundOuter=true;}
  }
  assert.ok(foundInner&&foundOuter);assert.equal(shirt.material.vertexColors,true);
  const arm=character.getObjectByName('Arm_left');assert.ok(Math.abs(arm.geometry.attributes.color.getX(0)-outer.r)<1e-5);
  assert.equal(character.getObjectByName('White_details').visible,false);assert.equal(character.getObjectByName('Face_ink').visible,false);
  assert.equal(character.getObjectByName('Original_face_ink').visible,true);
  controller.reset();assert.equal(shirt.material.color.getHexString(),original);assert.equal(shirt.geometry.attributes.color,undefined);assert.equal(shirt.material.vertexColors,false);assert.equal(character.getObjectByName('White_details').visible,true);
});
test('both garment colors persist, saving failure rolls back, and old dates expire',()=>{
  let record=JSON.stringify(appearance),fail=false;
  const storage={getItem:()=>record,setItem:(_k,value)=>{if(fail)throw Error('disk');record=value;},removeItem:()=>{record=null;}};
  const controller={current:null,apply(value){this.current=value;},reset(){this.current=null;}};
  const saved=mountStoredAppearance(controller,{storage});assert.deepEqual(controller.current,appearance);
  const next={...appearance,colors:{...appearance.colors,inner:'#123456'}};fail=true;
  assert.throws(()=>saved.set(next),/保存/);assert.deepEqual(controller.current,appearance);
  fail=false;saved.set(next);assert.equal(JSON.parse(record).colors.inner,'#123456');assert.equal(JSON.parse(record).colors.outer,appearance.colors.outer);
  saved.set(null);assert.equal(record,null);saved.dispose();
  record=JSON.stringify({...appearance,day:'2000-01-01'});const expired=mountStoredAppearance(controller,{storage});assert.equal(controller.current,null);expired.dispose();assert.ok(APPEARANCE_KEY);
});
