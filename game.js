import * as THREE from 'three';
import {createDancer} from './model.mjs';
import {AirPhysics} from './physics.js';
import {applyToon} from './toon.js';
import {SilhouetteEffect} from './silhouette.js';
import {createSkins} from './skins.js';
import {createClothing} from './clothing.js';
import {WorkGame} from './game-core.js';
import './game.css';

const $=s=>document.querySelector(s), game=new WorkGame();
const scene=new THREE.Scene(), renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
$('#world').append(renderer.domElement);
const camera=new THREE.OrthographicCamera(-10,10,13.2,-1.8,.1,100);camera.position.set(0,0,20);camera.lookAt(0,0,0);
const character=createDancer({rest:true,separateFace:true}).group;applyToon(character);scene.add(character);
const skins=createSkins(character);const clothing=createClothing(character,{onPaletteChange:p=>skins.setPalette(p)});clothing.select('pastel');
const simulation=new AirPhysics(character,{seed:4721,depthMotion:.15});simulation.setState('high');
const silhouette=new SilhouetteEffect(renderer,character);
const canvas=$('#effects'),ctx=canvas.getContext('2d'),sheet=new Image();sheet.src='./work-hazards.png';
let phase='ready',w=innerWidth,h=innerHeight,scale=h/800,last=0,particles=[],toastUntil=0,best=0,sound=false,audio;
try{best=Number(localStorage.getItem('air-worker-best')||0)||0;}catch{}$('#best').textContent=best;
function resize(){w=innerWidth;h=innerHeight;scale=h/800;renderer.setSize(w,h);const ratio=w/h;camera.left=-7.5*ratio;camera.right=7.5*ratio;camera.updateProjectionMatrix();canvas.width=w*Math.min(devicePixelRatio,2);canvas.height=h*Math.min(devicePixelRatio,2);canvas.style.width=w+'px';canvas.style.height=h+'px';}
addEventListener('resize',resize);resize();
function project(v){const p=v.clone().project(camera);return {x:p.x*w/2/scale,y:(1-p.y)*400,r:27};}
function body(){return [...simulation.nodes].reverse().filter((_,i)=>i%3===0).map(n=>project(n.p));}
function message(text,seconds=2){$('#toast').textContent=text;toastUntil=game.time+seconds;}
function tone(freq,duration=.08){if(!sound)return;try{audio??=new AudioContext();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.connect(gain);gain.connect(audio.destination);osc.frequency.setValueAtTime(freq,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(freq*.5,audio.currentTime+duration);gain.gain.setValueAtTime(.04,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.start();osc.stop(audio.currentTime+duration);}catch{}}
function controlsUI(){for(const side of ['left','right'])$('#'+side).setAttribute('aria-pressed',String(game.feet[side]));}
// Keep multiple physical input sources independent (keyboard, pointer, hardware).
const sources={left:new Set(),right:new Set()};
function pedal(side,down,source='hardware'){if(!sources[side])return;if(down&&phase!=='playing')return;down?sources[side].add(source):sources[side].delete(source);game.set(side,sources[side].size>0);controlsUI();}
function release(){sources.left.clear();sources.right.clear();game.release();controlsUI();}
for(const side of ['left','right']){const b=$('#'+side);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);pedal(side,true,'button'+e.pointerId);});const up=e=>pedal(side,false,'button'+e.pointerId);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);}
canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')game.aim=Math.max(-140,Math.min(140,(e.clientX-w/2)/scale*.6));});
canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);pedal(e.button===2?'right':'left',true,'mouse'+e.button);});
canvas.addEventListener('pointerup',e=>pedal(e.button===2?'right':'left',false,'mouse'+e.button));
canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
$('#game').addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select'))return;const side={KeyA:'left',KeyL:'right',ArrowLeft:'left',ArrowRight:'right'}[e.code];if(side){e.preventDefault();pedal(side,true,e.code);}if(!e.repeat&&(e.code==='KeyP'||e.code==='Escape')&&phase!=='ready'&&phase!=='over'){e.preventDefault();togglePause();}});
addEventListener('keyup',e=>{const side={KeyA:'left',KeyL:'right',ArrowLeft:'left',ArrowRight:'right'}[e.code];if(side)pedal(side,false,e.code);});
addEventListener('blur',()=>{release();if(phase==='playing')togglePause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){release();if(phase==='playing')togglePause();}});
window.addEventListener('air-worker-pedal',e=>{if(e.detail&&typeof e.detail.down==='boolean')pedal(e.detail.side,e.detail.down);});
window.airWorkerGame={setPedal:(side,down)=>pedal(side,Boolean(down)),get state(){return {phase,air:game.air,score:game.score,wave:game.wave,time:game.time};}};
function panel(title,copy,button){$('#overlay').hidden=false;$('#card-title').textContent=title;$('#card-copy').textContent=copy;$('#start').textContent=button;$('#start').focus();}
function togglePause(){release();if(phase==='playing'){phase='paused';panel('先喘口气。','进度已暂停，准备好再继续。','继续守护 ↗');$('#pause').textContent='继续';}else if(phase==='paused'){phase='playing';$('#overlay').hidden=true;$('#pause').textContent='暂停';}}
$('#pause').onclick=togglePause;
$('#start').onclick=()=>{if(phase==='paused'){togglePause();return;}game.reset();release();particles=[];simulation.setState('high');for(let i=0;i<25;i++){simulation.nodes[i].p.set(0,.64+i*4.9/24,0);simulation.nodes[i].old.copy(simulation.nodes[i].p);simulation.nodes[i].pressure=1;}phase='playing';$('#overlay').hidden=true;message('轻物长按挡开 · 图钉与 KPI 要看准时机踩一下',5);tone(440);};
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#game').requestFullscreen();}catch{message('浏览器未允许全屏，仍可在当前窗口游玩',4);}};
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').textContent=document.fullscreenElement?'退出全屏 ↙':'全屏 ↗';resize();});
$('#sound').onclick=()=>{sound=!sound;$('#sound').textContent='声音 '+(sound?'开':'关');$('#sound').setAttribute('aria-label',sound?'关闭音效':'开启音效');tone(550);};
function puff(x,y,color='#7d9b90',count=12){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2;particles.push({x,y,vx:Math.cos(a)*(40+Math.random()*150),vy:Math.sin(a)*120,life:.7,color});}}
function draw(dt,points){
  const dpr=canvas.width/w;ctx.setTransform(dpr*scale,0,0,dpr*scale,w*dpr/2,0);ctx.clearRect(-w/scale/2,0,w/scale,800);
  if(phase==='playing'||phase==='paused')for(const s of game.shields(points[0])){ctx.save();ctx.translate(s.x,s.y);ctx.strokeStyle=s.strong?'#406e60':'#7e9b90';ctx.fillStyle=s.active?'#a9c6b650':'#f5f2e242';ctx.lineWidth=s.strong?3:1.5;ctx.setLineDash(s.active?[]:[4,6]);ctx.beginPath();ctx.arc(0,0,s.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#4e6c60';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText(s.side==='left'?'A':'L',0,4);if(s.strong){ctx.beginPath();ctx.arc(0,0,s.r+10,-2.8,-.3);ctx.stroke();}ctx.restore();}
  for(const o of game.items){ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.angle);ctx.globalAlpha=o.safe?.65:1;
    if(!o.safe){ctx.strokeStyle='#778a7a65';ctx.lineWidth=1;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(i*9,-60);ctx.lineTo(i*9,-45);ctx.stroke();}}
    if(sheet.complete&&sheet.naturalWidth){const cw=sheet.naturalWidth/4;ctx.drawImage(sheet,cw*o.kind,0,cw,sheet.naturalHeight,-33,-44,66,88);}
    else{ctx.fillStyle='#9aa99b';ctx.beginPath();ctx.moveTo(-16,-24);ctx.lineTo(16,-24);ctx.lineTo(0,35);ctx.closePath();ctx.fill();}
    if(!o.safe&&(o.kind===1||o.kind===3)){ctx.fillStyle='#8b655a';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText('踩一下',0,-66);}ctx.restore();}
  for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.globalAlpha=Math.max(0,p.life/.7);ctx.strokeStyle=p.color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*.04,p.y-p.vy*.04);ctx.stroke();}particles=particles.filter(p=>p.life>0);ctx.globalAlpha=1;
  if(game.burst>0){ctx.strokeStyle='#46695b';ctx.lineWidth=4;ctx.globalAlpha=game.burst;ctx.beginPath();ctx.arc(points[0].x,points[0].y,(1-game.burst)*800+40,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
}
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000||0,.035);last=now;
  if(phase!=='paused'){simulation.target=phase==='over'?0:phase==='ready'?1:.38+game.air/100*.62;simulation.pedalLean=(Number(game.feet.right)-Number(game.feet.left))*.5;simulation.update(dt);}
  const points=body();
  if(phase==='playing'){
    game.update(dt,points);
    for(const ev of game.events.splice(0)){
      if(ev.type==='step'){tone(ev.side==='left'?220:300);for(let i=12;i<25;i++)simulation.nodes[i].old.x-=(ev.side==='left'?-.003:.003);}
      if(ev.type==='hit'){puff(ev.x,ev.y);tone(650,.045);}
      if(ev.type==='burst'){message('喘口气！工作暂时退散。',3);puff(points[0].x,points[0].y,'#537e68',35);tone(750,.3);}
      if(ev.type==='leak'){message('嘶——漏气了！踩踏补气，重新撑起来。',3);puff(ev.x,ev.y,'#ad8174',25);tone(100,.25);}
      if(ev.type==='pop'){phase='over';release();best=Math.max(best,game.score);try{localStorage.setItem('air-worker-best',String(best));}catch{}$('#best').textContent=best;panel('今天先躺平。',`守护了 ${Math.floor(game.time)} 秒，赶走 ${game.score/10} 件工作。休息一下，再充满气。`,'重新充气 ↗');}
    }
    if(game.time>toastUntil)$('#toast').textContent=game.wave===1?'单侧踩下击退重物 · 每次踩踏也会补气':'第 '+game.wave+' 波 · 工作越来越多，别忘了喘口气';
  }
  $('#score').textContent=String(game.score).padStart(4,'0');$('#time').textContent=String(Math.floor(game.time/60)).padStart(2,'0')+':'+String(Math.floor(game.time%60)).padStart(2,'0');$('#wave').textContent=String(game.wave).padStart(2,'0');$('#charge').value=game.charge;$('#air').value=game.air;$('#air-label').textContent=Math.ceil(game.air)+'%';
  character.visible=game.invulnerable<=0||Math.floor(now/100)%2===0||phase!=='playing';silhouette.render(scene,camera);draw(phase==='paused'?0:dt,points);
}
requestAnimationFrame(frame);
