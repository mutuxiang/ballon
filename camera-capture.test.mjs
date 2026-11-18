import test from 'node:test';
import assert from 'node:assert/strict';
import {captureFrame,withTimeout} from './camera-capture.js';

test('capture copies a decoded frame synchronously and bounds large camera images',()=>{
 const video={readyState:2,videoWidth:3840,videoHeight:2160};
 let args;
 const canvas={getContext:()=>({drawImage:(...a)=>{args=a;}})};
 const frame=captureFrame(video,()=>canvas);
 assert.equal(frame,canvas);
 assert.deepEqual([canvas.width,canvas.height],[960,540]);
 assert.deepEqual(args,[video,0,0,960,540]);
 assert.equal(frame.then,undefined);
});
test('unready or disconnected camera is rejected before canvas allocation',()=>{
 for(const video of [{readyState:1,videoWidth:640,videoHeight:480},{readyState:2,videoWidth:0,videoHeight:0}]){
  assert.throws(()=>captureFrame(video,()=>{throw Error('must not allocate');}),/尚未准备好/);
 }
});
test('frame read errors propagate so the UI can recover',()=>{
 assert.throws(()=>captureFrame({readyState:2,videoWidth:640,videoHeight:480},()=>({getContext:()=>({drawImage:()=>{throw Error('camera disconnected');}})})),/camera disconnected/);
});
test('camera timeout settles even when camera promise never returns',async()=>{
 await assert.rejects(withTimeout(new Promise(()=>{}),15,'camera timed out'),/camera timed out/);
 assert.equal(await withTimeout(Promise.resolve('ready'),100,'timeout'),'ready');
 await assert.rejects(withTimeout(Promise.reject(Error('denied')),100,'timeout'),/denied/);
});
