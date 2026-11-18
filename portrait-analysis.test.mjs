import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePortrait} from './portrait-analysis.mjs';
function fixture({skin=[211,165,125],hair=[38,39,35],shirt=[68,117,146],inner=shirt,long=false}){
 const width=240,height=320,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  let c=[225,232,228];
  if(x>55&&x<185&&y<65)c=hair;
  if(x>78&&x<162&&y>58&&y<153)c=skin;
  if(long&&y>65&&y<185&&((x>38&&x<73)||(x>167&&x<202)))c=hair;
  if(y>185&&x>35&&x<205)c=shirt;
  if(y>185&&x>102&&x<138)c=inner;
  data.set([...c,255],(y*width+x)*4);
 }
 return {width,height,data};
}
test('extracts solid portrait palette independently of the background',()=>{
 const f=analyzePortrait(fixture({}));
 assert.equal(f.skin,'#d3a57d');assert.equal(f.hair,'#262723');assert.equal(f.shirt,'#447592');
 assert.equal(f.outfit,'tee');assert.ok(f.confidence>.5);
});
test('distinguishes long side hair and contrasting jacket / inner garment',()=>{
 const f=analyzePortrait(fixture({long:true,inner:[25,27,29]}));
 assert.equal(f.hairstyle,'long');assert.equal(f.outfit,'jacket');assert.equal(f.inner,'#191b1d');
});
test('rejects corrupt image data and provides finite editable fallback for empty samples',()=>{
 assert.throws(()=>analyzePortrait({data:[],width:240,height:320}),/不完整/);
 const data=new Uint8ClampedArray(240*320*4);const f=analyzePortrait({data,width:240,height:320});
 assert.equal(f.confidence,0);for(const key of ['skin','hair','shirt','inner'])assert.match(f[key],/^#[0-9a-f]{6}$/);
});
