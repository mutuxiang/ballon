import * as THREE from 'three';
import {createDancer} from './model.mjs';
import {AirPhysics} from './physics.js';
import {applyToon} from './toon.js';
import {SilhouetteEffect} from './silhouette.js';
import {createSkins} from './skins.js';
import {createClothing} from './clothing.js';
import {createSkinGradient} from './skin-gradient.js';
import {WorkGame,BARRAGE_STEPS,defenseAnchor,ACTION_LABELS,HIT_WINDOW} from './game-core.js';
import {createMotionExpressions} from './motion-expressions.js';
import {createGameExpressions} from './game-expression.js';
import {applyExerciseMove,updateExerciseTurn} from './game-motion.js';
import {hazardRotation,loadAtlas} from './game-art.js';
import {createPoseBackdrop} from './pose-backdrop.js';
import {createThemeSkins} from './theme-skins.js';
import {mountThemePicker} from './theme-picker.js';
import './game.css';

const $=s=>document.querySelector(s), game=new WorkGame();
const scene=new THREE.Scene(), renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
$('#world').append(renderer.domElement);
const camera=new THREE.OrthographicCamera(-10,10,11.05,-3.55,.1,100);camera.position.set(0,0,20);camera.lookAt(0,0,0);
const character=createDancer({rest:true,separateFace:true}).group;applyToon(character);scene.add(character);
const skins=createSkins(character);const clothing=createClothing(character,{onPaletteChange:p=>skins.setPalette(p)});clothing.select('pastel');
const skinGradient=createSkinGradient(character,skins);skinGradient.setEnabled(true);
const simulation=new AirPhysics(character,{seed:4721,depthMotion:.65});simulation.setState('high');
const faceController=createGameExpressions();
let motionSkin='chill',face='',hitFlash=0,hurtFlash=0,burstFlash=0;
const expressions=createMotionExpressions(id=>{motionSkin=id;});expressions.setEnabled(true,simulation);
const silhouette=new SilhouetteEffect(renderer,character);
const themeSkins=createThemeSkins(scene,character,camera,{reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
themeSkins.bind(simulation);
const themePicker=mountThemePicker($('#game'),themeSkins,{compact:true,onSelect:()=>{if(phase==='playing')togglePause();}});
const canvas=$('#effects'),ctx=canvas.getContext('2d');
const poseBackdrop=createPoseBackdrop($('#pose-layer'));
const hazardAtlas=loadAtlas('./work-symbols-hatched.png',3,2);
let phase='ready',w=innerWidth,h=innerHeight,scale=h/800,last=0,particles=[],best=0,sound=false,audio;
let mouseSide='left',padConnected=false,hardwareActive=false;
let judgment='',judgmentTime=0,judgmentQuality='',lastMove='',moveFlash=0;
const axisLatch={left:null,right:null};const heldKeys=new Set();
try{best=Number(localStorage.getItem('air-worker-best')||0)||0;}catch{}$('#best').textContent=best;
function resize(){w=innerWidth;h=innerHeight;scale=h/800;game.setViewport(w/scale/2);renderer.setSize(w,h);const ratio=w/h,viewHeight=Math.max(14.6,7.5/ratio);camera.left=-viewHeight*ratio/2;camera.right=viewHeight*ratio/2;camera.top=3.75+viewHeight/2;camera.bottom=3.75-viewHeight/2;camera.updateProjectionMatrix();canvas.width=w*Math.min(devicePixelRatio,2);canvas.height=h*Math.min(devicePixelRatio,2);canvas.style.width=w+'px';canvas.style.height=h+'px';poseBackdrop.resize(w,h);}
addEventListener('resize',resize);resize();
function project(v){const p=character.localToWorld(v.clone()).project(camera);return {x:p.x*w/2/scale,y:(1-p.y)*400,r:27};}
function body(){return [...simulation.nodes].reverse().filter((_,i)=>i%3===0).map(n=>project(n.p));}
function tone(freq,duration=.08){if(!sound)return;try{audio??=new AudioContext();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.connect(gain);gain.connect(audio.destination);osc.frequency.setValueAtTime(freq,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(freq*.5,audio.currentTime+duration);gain.gain.setValueAtTime(.04,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.start();osc.stop(audio.currentTime+duration);}catch{}}
// Keep multiple physical input sources independent (keyboard, pointer, hardware).
const sources={left:new Set(),right:new Set()};
function pedal(side,down,source='hardware'){if(!sources[side])return;if(down&&phase!=='playing')return;down?sources[side].add(source):sources[side].delete(source);game.set(side,sources[side].size>0);}
function release(){sources.left.clear();sources.right.clear();game.release();heldKeys.clear();axisLatch.left=axisLatch.right=null;}
function selectMouse(side){
  release();mouseSide=side;hardwareActive=false;
  for(const key of ['left','right']){const s=game.sticks[key];game.setStick(key,s.x,s.y,key===side);}
}
function perform(action,side='left'){if(phase!=='playing')return;game.perform(action,side);}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);pedal(mouseSide,true,'mouse');});
canvas.addEventListener('pointerup',()=>pedal(mouseSide,false,'mouse'));
canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
$('#game').addEventListener('contextmenu',e=>e.preventDefault());
const keyMoves={KeyW:['up','left'],KeyS:['down','left'],KeyA:['left','left'],KeyD:['right','left'],KeyQ:['rotate','left'],KeyI:['up','right'],KeyK:['down','right'],KeyJ:['left','right'],KeyL:['right','right'],KeyU:['rotate','right']};
addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea,select'))return;
  if(e.code==='Space'&&phase!=='playing'){
    if(e.target.matches('button'))return;
    e.preventDefault();if(!e.repeat)$('#coach-action').click();return;
  }
  if(keyMoves[e.code]){e.preventDefault();if(!e.repeat&&!heldKeys.has(e.code)){heldKeys.add(e.code);perform(...keyMoves[e.code]);}}
  if(e.code==='Space')e.preventDefault();
  const stepSide={KeyF:'left',KeyH:'right'}[e.code];
  if(stepSide){e.preventDefault();if(!e.repeat)pedal(stepSide,true,e.code);}
  if(!e.repeat&&(e.code==='KeyP'||e.code==='Escape')&&phase!=='ready'&&phase!=='over'){e.preventDefault();togglePause();}
});
addEventListener('keyup',e=>{heldKeys.delete(e.code);const side={KeyF:'left',KeyH:'right'}[e.code];if(side)pedal(side,false,e.code);});
addEventListener('blur',()=>{release();if(phase==='playing')togglePause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){release();if(phase==='playing')togglePause();}});
function analogAction(side,x,y){
  if(Math.hypot(x,y)<.25){axisLatch[side]=null;return;}
  if(Math.max(Math.abs(x),Math.abs(y))<.6||Math.min(Math.abs(x),Math.abs(y))>.4)return;
  const action=Math.abs(x)>Math.abs(y)?x>0?'right':'left':y>0?'down':'up';
  if(axisLatch[side]===null){axisLatch[side]=action;perform(action,side);}
}
function hardwareStick(side,x,y,down=false){if(!game.sticks[side]||!Number.isFinite(x)||!Number.isFinite(y))return;hardwareActive=true;game.setStick(side,x,y);if(phase==='playing')analogAction(side,x,y);pedal(side,Boolean(down));}
window.addEventListener('air-worker-pedal',e=>{const d=e.detail;if(!d||!game.sticks[d.side])return;const s=game.sticks[d.side];hardwareStick(d.side,d.x??s.x,d.y??s.y,d.down);});
window.airWorkerGame={perform, setPedal:(side,down)=>{const s=game.sticks[side];if(s)hardwareStick(side,s.x,s.y,down);},setStick:hardwareStick,disconnect:()=>{release();selectMouse(mouseSide);},get state(){return {phase,air:game.air,score:game.score,wave:game.wave,time:game.time,barrage:game.barrageState,barrageRemaining:game.barrageRemaining,charge:game.charge,combo:game.combo,nextAction:game.nextNote?.action,sticks:structuredClone(game.sticks)};}};
function updateInput(points){
  const pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected&&p.mapping==='standard');
  if(pad){
    if(!padConnected){release();padConnected=true;}hardwareActive=false;
    for(const [side,axis,trigger] of [['left',0,6],['right',2,7]]){
      const x=pad.axes[axis]||0,y=pad.axes[axis+1]||0;
      game.setStick(side,x,y);analogAction(side,x,y);const rotateButton=side==='left'?4:5,tag='rotate-'+side;if(pad.buttons[rotateButton]?.pressed){if(!heldKeys.has(tag)){heldKeys.add(tag);perform('rotate',side);}}else heldKeys.delete(tag);
      pedal(side,Boolean(pad.buttons[trigger]?.pressed),'gamepad');
    }
  }else{
    if(padConnected){padConnected=false;selectMouse(mouseSide);}
  }
}
function panel(copy,button){$('#coach').hidden=false;$('#coach-copy').textContent=copy;$('#coach-action').textContent=button;$('#coach-action').focus();}
function togglePause(){release();if(phase==='playing'){phase='paused';panel('先喘口气。准备好再继续。','继续活动');$('#pause').textContent='继续';}else if(phase==='paused'){phase='playing';$('#coach').hidden=true;$('#coach-action').blur();$('#pause').textContent='暂停';}}
$('#pause').onclick=togglePause;
$('#coach-action').onclick=()=>{if(phase==='paused'){togglePause();return;}if(phase==='playing')return;game.reset();faceController.reset();character.rotation.y=0;character.userData.exerciseTurn=0;selectMouse(mouseSide);particles=[];hitFlash=0;hurtFlash=0;burstFlash=0;judgment='';judgmentTime=0;moveFlash=0;simulation.setState('high');for(let i=0;i<25;i++){simulation.nodes[i].p.set(0,.64+i*4.9/24,0);simulation.nodes[i].old.copy(simulation.nodes[i].p);simulation.nodes[i].pressure=1;}phase='playing';$('#coach').hidden=true;$('#coach-action').blur();tone(440);};
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#game').requestFullscreen();}catch{$('#fullscreen').title='浏览器暂未允许全屏';}};
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').textContent=document.fullscreenElement?'退出全屏':'全屏';resize();});
$('#sound').onclick=()=>{sound=!sound;$('#sound').textContent='声音 '+(sound?'开':'关');$('#sound').setAttribute('aria-label',sound?'关闭音效':'开启音效');tone(550);};
function puff(x,y,color='#c69b57',count=12){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2;particles.push({x,y,vx:Math.cos(a)*(40+Math.random()*150),vy:Math.sin(a)*120,life:.7,color});}}
function draw(dt,points){
  const dpr=canvas.width/w;ctx.setTransform(dpr*scale,0,0,dpr*scale,w*dpr/2,0);ctx.clearRect(-w/scale/2,0,w/scale,800);
  const anchor=defenseAnchor(points),radius=game.ringRadius;
  if(phase==='ready'||phase==='playing'||phase==='paused'){
    // Small inward ticks mark the three approach directions, outside the judgment line.
    const sideDistance=Math.min(radius+140,game.halfWidth-28);
    ctx.save();ctx.strokeStyle='#a18a683e';ctx.lineWidth=1.5;
    for(const [x,y,angle] of [[anchor.x-sideDistance,anchor.y,0],[anchor.x+sideDistance,anchor.y,Math.PI],[anchor.x,Math.max(205,anchor.y-radius-60),Math.PI/2]]){
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);
      for(let i=0;i<2;i++){ctx.beginPath();ctx.moveTo(-12-i*10,-7);ctx.lineTo(-5-i*10,0);ctx.lineTo(-12-i*10,7);ctx.stroke();}
      ctx.restore();
    }
    ctx.restore();
    ctx.strokeStyle='#7869586e';ctx.lineWidth=1;ctx.beginPath();ctx.arc(anchor.x,anchor.y,radius,0,Math.PI*2);ctx.stroke();
    if(game.barrage){ctx.save();ctx.strokeStyle='#ad754d';ctx.setLineDash([5,9]);ctx.lineWidth=2;ctx.beginPath();ctx.arc(anchor.x,anchor.y,radius+12,0,Math.PI*2);ctx.stroke();ctx.restore();}
    const next=game.nextNote;
    if(next){const angle=Math.atan2(next.dy,next.dx);ctx.strokeStyle=Math.abs(game.time-next.hitAt)<=HIT_WINDOW?'#ba8238':'#b6a08a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(anchor.x,anchor.y,radius,angle-.12,angle+.12);ctx.stroke();}
    ctx.textAlign='center';
    if(judgmentTime>0){ctx.globalAlpha=Math.min(1,judgmentTime*3);ctx.fillStyle=judgmentQuality==='miss'?'#ae6d58':'#96692e';ctx.font='bold 23px sans-serif';ctx.fillText(judgment,anchor.x,anchor.y-radius-38);ctx.globalAlpha=1;}
    if(game.combo>1){ctx.font='12px sans-serif';ctx.fillStyle='#9b7951';ctx.fillText(game.combo+' COMBO',anchor.x,anchor.y+radius+40);}
    if(moveFlash>0){ctx.globalAlpha=moveFlash/.4;ctx.font='28px sans-serif';ctx.fillStyle='#ae8043';ctx.fillText(ACTION_LABELS[lastMove]||'',anchor.x+radius+22,anchor.y);ctx.globalAlpha=1;}
  }
  for(const o of game.items){
    if(o.removed)continue;
    ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.angle);ctx.globalAlpha=o.safe?.65:1;
    if(!o.safe){ctx.strokeStyle='#8f7d6865';ctx.lineWidth=1;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(i*9,-60);ctx.lineTo(i*9,-45);ctx.stroke();}}
    // Rotate each distinct source tip inward; input glyphs remain upright.
    ctx.rotate(hazardRotation(o.kind,o.dx,o.dy)-o.angle);
    if(!hazardAtlas.draw(ctx,o.kind,0,0,68)){
      ctx.fillStyle='#fffaf0';ctx.strokeStyle='#332d28';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(0,-32);ctx.lineTo(12,-12);ctx.lineTo(32,0);ctx.lineTo(12,12);ctx.lineTo(0,32);ctx.lineTo(-12,12);ctx.lineTo(-32,0);ctx.lineTo(-12,-12);ctx.closePath();ctx.fill();ctx.stroke();
    }
    ctx.restore();
    if(!o.safe&&!o.barrage){ctx.fillStyle=o.failed?'#c5a092':'#fffaf0';ctx.strokeStyle=o.failed?'#c5a092':'#8d7356';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(o.x,o.y-47,18,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#44382b';ctx.textAlign='center';ctx.font='bold 23px sans-serif';ctx.fillText(ACTION_LABELS[o.action],o.x,o.y-39);ctx.font='10px sans-serif';ctx.fillText(o.side==='left'?'左脚':'右脚',o.x,o.y-71);}
  }
  for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.globalAlpha=Math.max(0,p.life/.7);ctx.strokeStyle=p.color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*.04,p.y-p.vy*.04);ctx.stroke();}particles=particles.filter(p=>p.life>0);ctx.globalAlpha=1;
  if(game.burst>0){ctx.strokeStyle='#aa783b';ctx.lineWidth=4;ctx.globalAlpha=game.burst;ctx.beginPath();ctx.arc(points[0].x,points[0].y,(1-game.burst)*800+40,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
}
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000||0,.035);last=now;
  if(phase!=='paused'){judgmentTime=Math.max(0,judgmentTime-dt);moveFlash=Math.max(0,moveFlash-dt);hitFlash=Math.max(0,hitFlash-dt);hurtFlash=Math.max(0,hurtFlash-dt);burstFlash=Math.max(0,burstFlash-dt);simulation.target=phase==='over'?0:phase==='ready'?1:.38+game.air/100*.62;simulation.pedalLean=(Number(game.feet.right)-Number(game.feet.left))*.5;simulation.superMode=burstFlash>0;updateExerciseTurn(character,dt);simulation.update(dt);skinGradient.update(simulation);expressions.update(dt,simulation);skins.setFocus(burstFlash>0);}
  if($('#game').dataset.phase!==phase)$('#game').dataset.phase=phase;
  const points=body();
  if(phase==='playing'){
    updateInput(points);
    game.update(dt,points);
    for(const ev of game.events.splice(0)){
      if(ev.type==='judge'){judgment=ev.text;judgmentQuality=ev.quality;judgmentTime=.7;}
      if(ev.type==='action'){lastMove=ev.action;moveFlash=.4;tone(260,.04);applyExerciseMove(simulation,character,ev.action,ev.side);}

      if(ev.type==='step'){tone(ev.side==='left'?220:300);for(let i=12;i<25;i++)simulation.nodes[i].old.x-=(ev.side==='left'?-.003:.003);}
      if(ev.type==='hit'){hitFlash=.8;puff(ev.x,ev.y);tone(650,.045);}
      if(ev.type==='barrage-warning'){release();judgment='攻击大爆发 · 准备双脚';judgmentQuality='warning';judgmentTime=2;tone(380,.25);}
      if(ev.type==='barrage-miss'){judgment='没关系，继续下一拍';judgmentQuality='miss';judgmentTime=1.5;}
      if(ev.type==='burst'){release();burstFlash=1.8;judgment='全部击退！';judgmentQuality='perfect';judgmentTime=1.5;puff(points[0].x,points[0].y,'#c08b43',35);tone(750,.3);}
      if(ev.type==='leak'){hurtFlash=1.2;puff(ev.x,ev.y,'#b17861',25);tone(100,.25);}
      if(ev.type==='pop'){phase='over';release();best=Math.max(best,game.score);try{localStorage.setItem('air-worker-best',String(best));}catch{}$('#best').textContent=best;panel(`活动了 ${Math.floor(game.time)} 秒，最高 ${game.bestCombo} 连击。休息一下，再充满气。`,'重新充气');}
    }
  }
  $('#score').textContent=String(game.score).padStart(4,'0');$('#wave').textContent=String(game.wave).padStart(2,'0');$('#charge').max=BARRAGE_STEPS;$('#charge').value=game.charge;
  const warning=game.barrageState==='warning';
  $('#barrage-title').textContent=warning?'攻击大爆发 · 准备双脚':'攻击大爆发 · 交替快踩！';
  $('#charge-label').textContent=warning?Math.ceil(game.barrage.rushAt-game.time)+' 秒后来袭':Math.ceil(game.barrageRemaining)+' 秒 · '+Math.floor(game.charge)+' / '+BARRAGE_STEPS;
  $('#step-left').classList.toggle('pressed',game.feet.left);$('#step-right').classList.toggle('pressed',game.feet.right);
  $('#barrage-hint').textContent=warning?'等攻击开始，左右交替按下并松开':'下一脚：'+(game.lastChargeSide==='left'?'右脚 H':game.lastChargeSide==='right'?'左脚 F':'任选一脚开始');
  $('#air').value=game.air;$('#air-label').textContent=Math.ceil(game.air)+'%';
  $('.energy').hidden=phase!=='playing'||!game.barrage;
  if(phase!=='paused'){
    const threat=game.items.some(o=>!o.safe&&!o.warning&&points.some(p=>Math.hypot(o.x-p.x,o.y-p.y)<150));
    const next=faceController.update(dt,{over:phase==='over',burst:burstFlash,hurt:hurtFlash,charge:game.charge,hit:hitFlash,air:game.air,threat,motionSkin});
    if(next!==face){skins.select(next);face=next;}
  }
  character.visible=game.invulnerable<=0||Math.floor(now/100)%2===0||phase!=='playing';themeSkins.update(phase==='paused'?0:dt,simulation);silhouette.render(scene,camera);draw(phase==='paused'?0:dt,points);
}
requestAnimationFrame(frame);
