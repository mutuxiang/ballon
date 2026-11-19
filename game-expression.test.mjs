import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gameExpression,createGameExpressions} from './game-expression.js';
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

test('brief danger flicker cannot replace a held expression; sustained states settle',()=>{
  const controller=createGameExpressions();
  assert.equal(controller.update(0,idle),'smile');
  for(let i=0;i<40;i++)assert.equal(controller.update(.1,{...idle,threat:i%2===0}),'smile');
  for(let i=0;i<7;i++)controller.update(.1,{...idle,threat:true});
  assert.equal(controller.update(.1,{...idle,threat:true}),'narrow');
});

test('damage and ultimate interrupt promptly, then stay readable after the event ends',()=>{
  const controller=createGameExpressions();controller.update(0,idle);
  assert.equal(controller.update(.1,{...idle,hurt:1}),'pout');
  for(let i=0;i<15;i++)assert.equal(controller.update(.1,idle),'pout');
  assert.equal(controller.update(.1,{...idle,burst:1}),'sparkle-grin');
  for(let i=0;i<15;i++)assert.equal(controller.update(.1,idle),'sparkle-grin');
  for(let i=0;i<15;i++)controller.update(.1,idle);
  assert.equal(controller.update(.1,idle),'smile');
  controller.reset();assert.equal(controller.update(0,{...idle,motionSkin:'chill'}),'chill');
});
