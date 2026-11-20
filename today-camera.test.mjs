import test from 'node:test';
import assert from 'node:assert/strict';
import {createCameraSession,cameraErrorMessage} from './today-camera.js';

function fakeStream(){
  const track=new EventTarget();track.stops=0;track.stop=()=>track.stops++;
  return {track,getTracks:()=>[track],getVideoTracks:()=>[track]};
}
test('requests a front-facing camera without microphone, releases on stop',async()=>{
  const stream=fakeStream();let constraints;
  const camera=createCameraSession({getUserMedia:async value=>{constraints=value;return stream;}});
  assert.equal(await camera.start(),stream);
  assert.equal(constraints.audio,false);assert.equal(constraints.video.facingMode.ideal,'user');
  camera.stop();camera.stop();assert.equal(stream.track.stops,1);
});
test('closing while permission is pending releases a late stream',async()=>{
  let resolve;
  const camera=createCameraSession({getUserMedia:()=>new Promise(r=>resolve=r)});
  const pending=camera.start();camera.stop();const stream=fakeStream();resolve(stream);
  assert.equal(await pending,null);assert.equal(stream.track.stops,1);
});
test('old permission response cannot replace a newer camera session',async()=>{
  const requests=[];
  const camera=createCameraSession({getUserMedia:()=>new Promise(resolve=>requests.push(resolve))});
  const first=camera.start(),second=camera.start();const old=fakeStream(),current=fakeStream();
  requests[1](current);assert.equal(await second,current);
  requests[0](old);assert.equal(await first,null);assert.equal(old.track.stops,1);assert.equal(current.track.stops,0);
  camera.stop();assert.equal(current.track.stops,1);
});
test('device disconnection releases remaining tracks and notifies once',async()=>{
  const stream=fakeStream();let ended=0;
  const camera=createCameraSession({getUserMedia:async()=>stream},()=>ended++);
  await camera.start();stream.track.dispatchEvent(new Event('ended'));
  assert.equal(ended,1);assert.equal(stream.track.stops,1);
});
test('denied permission can be retried; stale denial is ignored',async()=>{
  const denied=Object.assign(new Error(),{name:'NotAllowedError'});let fail=true;
  const stream=fakeStream();const camera=createCameraSession({getUserMedia:async()=>{if(fail)throw denied;return stream;}});
  await assert.rejects(camera.start(),{name:'NotAllowedError'});assert.match(cameraErrorMessage(denied),/授权/);
  fail=false;assert.equal(await camera.start(),stream);camera.stop();
  let reject;const late=createCameraSession({getUserMedia:()=>new Promise((_,r)=>reject=r)});
  const pending=late.start();late.stop();reject(denied);assert.equal(await pending,null);
});
test('unsupported environment reports a useful fallback',async()=>{
  await assert.rejects(createCameraSession(undefined).start(),{message:'CAMERA_UNAVAILABLE'});
  assert.match(cameraErrorMessage(new Error('CAMERA_UNAVAILABLE')),/localhost/);
});
