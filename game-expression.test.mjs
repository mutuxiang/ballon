import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gameExpression} from './game-expression.js';
const idle={over:false,burst:0,hurt:0,charge:0,hit:0,air:100,threat:false,motionSkin:'smile'};
test('expressions react to danger, leaks, successful defense, charge and ultimate',()=>{
  assert.equal(gameExpression(idle),'smile');
  for(const [state,value,face] of [['threat',true,'narrow'],['air',20,'sleepy-grin'],['hit',.8,'confident'],['charge',2,'sparkle'],['hurt',1,'pout'],['burst',1,'sparkle-grin'],['over',true,'narrow']])assert.equal(gameExpression({...idle,[state]:value}),face);
});
test('hurt overrides defense and charging, ultimate overrides damage, end overrides all',()=>{
  assert.equal(gameExpression({...idle,hurt:1,hit:1,charge:3}),'pout');
  assert.equal(gameExpression({...idle,hurt:1,burst:1}),'sparkle-grin');
  assert.equal(gameExpression({...idle,over:true,burst:1}),'narrow');
});
