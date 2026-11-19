import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spriteBounds,spriteSize,HAZARDS} from './game-art.js';

test('atlas sizing uses visible alpha and never includes neighboring cells',()=>{
  const pixels=new Uint8ClampedArray(20*10*4);
  function fill(x,y,width,height,alpha){for(let row=y;row<y+height;row++)for(let col=x;col<x+width;col++)pixels[(row*20+col)*4+3]=alpha;}
  fill(2,3,5,4,255);fill(9,0,1,1,10);fill(10,0,10,10,255);
  const cell=spriteBounds(pixels,20,0,0,10,10);
  assert.deepEqual(cell,{x:2,y:3,width:5,height:4});
  assert.deepEqual(spriteSize(cell,68),{width:68,height:54.4});
});
test('portrait and landscape hazards share one longest dimension without stretching',()=>{
  for(const [width,height] of [[346,466],[460,394],[409,451]]){
    const size=spriteSize({width,height},68);
    assert.ok(Math.abs(Math.max(size.width,size.height)-68)<1e-8);
    assert.ok(Math.abs(size.width/size.height-width/height)<1e-8);
  }
  assert.equal(HAZARDS.length,6);
});
test('transparent atlas cells are skipped instead of yielding invalid rectangles',()=>{
  assert.equal(spriteBounds(new Uint8ClampedArray(10*10*4),10,0,0,10,10),null);
});
