import {advanceObstacles,createObstacle,touchesCharacter} from './play-physics.js';
import './play-mode.css';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function mountAirGame({scene,camera,controls,simulation,pedals,selectState,floor,ring,onPlaying}){
 const launch=document.createElement('button');launch.className='game-launch';launch.textContent='进入游玩 ↗';document.body.append(launch);
 const backdrop=document.createElement('div');backdrop.className='game-backdrop';backdrop.hidden=true;backdrop.style.backgroundImage=`url("${new URL('./office-play-bg.png',document.baseURI).href}")`;
 const root=document.createElement('section');root.className='game-world';root.hidden=true;root.tabIndex=-1;root.setAttribute('aria-label','鼠标保护圈守护气球人');
 root.innerHTML=`<canvas class="game-field" aria-hidden="true"></canvas>
 <div class="game-top"><div class="game-brand"><span class="game-kicker">AIR WORKER / PLAYTIME</span><h2>把压力，轻轻推开。</h2></div><div class="game-stats"><span>守护时间 <b data-time>00:00</b></span><span>推开压力 <b data-score>0</b></span></div><button data-pause>暂停</button><button data-exit>退出 ↗</button></div>
 <div class="game-wave"><i></i> 写字楼门口 <span data-wave>01</span></div><div class="game-toast" role="status" aria-live="polite"></div>
 <div class="game-bottom"><span class="game-mouse-mark">↔</span><div><strong>移动鼠标，带动保护圈</strong><span>迎着落物推开 · 挥得越快，推得越远 · 小心反弹</span></div><div class="game-air"><span>小人的气量 <b data-air-value>100%</b></span><div role="meter" aria-label="小人的气量" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i></i></div><small data-air-hint>挡住压力，慢慢回气</small></div><small>方向键也可移动 · P 暂停 · Esc 退出</small></div>
 <div class="game-dialog" role="dialog" aria-modal="true" aria-labelledby="game-title"><span class="game-kicker">LEAVE THE PRESSURE AT THE DOOR.</span><h1 id="game-title">给打工人，<br>留一点空气。</h1><p>鼠标移动保护圈，碰撞推开掉落的工作。<br>小人被碰到会漏气、慢慢软下来。<br>继续挡住压力，推开落物帮他补气。</p><button data-start>开始游玩 →</button><small>无需按住鼠标 · 触屏拖动也可操作</small></div>`;
 document.body.append(backdrop,root);
 const $=q=>root.querySelector(q),canvas=$('canvas'),ctx=canvas.getContext('2d'),dialog=$('.game-dialog');
 let active=false,phase='ready',saved,elapsed=0,score=0,wave=0,waveTimer=0,acc=0,objects=[],sparks=[],toastTime=0,pressure=1,leakCooldown=0,sinceHit=10,leakFlash=0,wasFullscreen=false;
 const bumper={x:innerWidth/2,y:innerHeight*.4,vx:0,vy:0,r:32,half:0,tx:innerWidth/2,ty:innerHeight*.4,tilt:0,impact:0};
 const keys=new Set();let aimSeen=false;
 const themes=[{label:'紧急邮件',type:'mail',color:'#f2c4c8'},{label:'临时需求',type:'paper',color:'#c2dde2'},{label:'会议',type:'calendar',color:'#c7d5bc'},{label:'截止',type:'clock',color:'#efdbb6'}];
 const project=v=>{const p=v.clone().project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};};
 const scale=()=>clamp(innerHeight/900,.72,1.15);
 function toast(text){$('.game-toast').textContent=text;toastTime=2.4;}
 function resize(){const d=Math.min(devicePixelRatio,2);canvas.width=Math.round(innerWidth*d);canvas.height=Math.round(innerHeight*d);ctx.setTransform(d,0,0,d,0,0);bumper.r=32*scale();bumper.half=0;bumper.tx=clamp(bumper.tx,50,innerWidth-50);bumper.ty=clamp(bumper.ty,120,innerHeight-110);}
 addEventListener('resize',resize);resize();
 function positionCamera(){camera.position.set(0,5.6,21);controls.target.set(0,5.6,0);camera.lookAt(controls.target);if(camera.isOrthographicCamera){camera.top=7;camera.bottom=-7;camera.left=-7*innerWidth/innerHeight;camera.right=-camera.left;}camera.updateProjectionMatrix();}
 function readyDialog(){phase='ready';dialog.hidden=false;$('#game-title').innerHTML='给打工人，<br>留一点空气。';$('.game-dialog p').innerHTML='鼠标移动保护圈，碰撞推开掉落的工作。<br>小人被碰到会漏气、慢慢软下来。<br>继续挡住压力，推开落物帮他补气。';$('[data-start]').textContent='开始游玩 →';}
 function enter(){if(active)return;active=true;saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),target:controls.target.clone(),zoom:camera.zoom,left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom,bg:scene.background,floor:floor.visible,ring:ring.visible,enabled:controls.enabled};pedals.cancelSuper();pedals.reset();onPlaying();selectState('high');document.documentElement.classList.add('air-game');root.hidden=backdrop.hidden=false;scene.background=null;floor.visible=ring.visible=false;controls.enabled=false;camera.zoom=1;positionCamera();objects=[];sparks=[];readyDialog();window.desktopPet?.game(true);wasFullscreen=!!document.fullscreenElement;$('[data-start]').focus();}
 function exit(){if(!active)return;active=false;keys.clear();pedals.reset();selectState('high');document.documentElement.classList.remove('air-game');root.hidden=backdrop.hidden=true;camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);camera.zoom=saved.zoom;if(camera.isOrthographicCamera)for(const k of ['left','right','top','bottom'])camera[k]=saved[k];camera.updateProjectionMatrix();controls.target.copy(saved.target);controls.enabled=saved.enabled;scene.background=saved.bg;floor.visible=saved.floor;ring.visible=saved.ring;window.desktopPet?.game(false);if(!wasFullscreen&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});launch.focus();}
 function start(){if(phase==='paused'){phase='playing';dialog.hidden=true;$('[data-pause]').textContent='暂停';return;}phase='playing';dialog.hidden=true;elapsed=score=wave=acc=0;pressure=1;leakCooldown=0;sinceHit=10;leakFlash=0;waveTimer=.9;objects=[];sparks=[];keys.clear();pedals.reset();simulation.pedalLean=0;selectState('high');const h=project(simulation.nodes[24].p);bumper.x=bumper.tx=innerWidth/2;bumper.y=bumper.ty=clamp(h.y-145*scale(),150,innerHeight*.55);bumper.vx=bumper.vy=bumper.tilt=0;bumper.impact=0;aimSeen=false;root.focus({preventScroll:true});toast('移到落物前，碰到它，再往旁边推。');if(!window.desktopPet&&!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});}
 function pause(){if(phase==='playing'){phase='paused';keys.clear();dialog.hidden=false;$('#game-title').textContent='歇一口气。';$('.game-dialog p').textContent='保护圈和落物都停住了。准备好再继续。';$('[data-start]').textContent='继续游玩 →';$('[data-pause]').textContent='继续';$('[data-start]').focus();}else if(phase==='paused')start();}
 function leak(at){if(leakCooldown>0)return;pressure=Math.max(0,pressure-.16);sinceHit=0;leakCooldown=1.6;leakFlash=.65;emit(at.x,at.y,'#a8d8d3',12);toast(pressure<.15?'有点漏气了……帮他挡一挡，慢慢恢复。':'嘶——漏了一点气，继续帮他挡住压力。');}
 function aim(x,y){bumper.tx=clamp(x,bumper.r+bumper.half+5,innerWidth-bumper.r-bumper.half-5);bumper.ty=clamp(y,110,innerHeight-95);aimSeen=true;}
 root.addEventListener('pointermove',e=>{if(phase==='playing'&&!e.target.closest('button'))aim(e.clientX,e.clientY);});
 root.addEventListener('pointerdown',e=>{if(phase==='playing'&&!e.target.closest('button')){e.preventDefault();aim(e.clientX,e.clientY);if(e.pointerType!=='mouse')root.setPointerCapture(e.pointerId);}});
 addEventListener('keydown',e=>{if(!active)return;if(e.code==='Escape'){e.preventDefault();exit();}if(e.code==='KeyP'&&!e.repeat){e.preventDefault();pause();}if(e.code.startsWith('Arrow')){e.preventDefault();keys.add(e.code);}});
 addEventListener('keyup',e=>keys.delete(e.code));
 addEventListener('blur',()=>{keys.clear();if(active&&phase==='playing')pause();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&active&&phase==='playing')pause();});
 document.addEventListener('fullscreenchange',()=>{if(active&&!document.fullscreenElement&&!wasFullscreen&&!window.desktopPet&&phase==='playing')pause();resize();});
 if(new URLSearchParams(location.search).has('play'))queueMicrotask(enter);
 launch.onclick=enter;$('[data-exit]').onclick=exit;$('[data-pause]').onclick=pause;$('[data-start]').onclick=start;
 window.desktopPet?.onAction(({type})=>{if(type==='game')enter();if(type==='game-exit')exit();});
 function emit(x,y,color,count=7){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=65+Math.random()*160;sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:.35+Math.random()*.25,color});}}
 function spawnWave(){wave++;const s=scale(),cx=innerWidth/2,spacing=66*s,base=-45*s;
  const pattern=(wave-1)%4,theme=themes[(wave-1)%themes.length];
  const add=(x,y,index=0)=>objects.push(createObstacle({x,y,r:(theme.type==='clock'?22:25)*s,vy:(60+Math.min(48,wave*3))*s,vx:0,angle:(index%2?1:-1)*.1,spin:(index%3-1)*.12,...theme}));
  if(pattern===0){for(let i=-2;i<=2;i++)add(cx+i*spacing,base-Math.abs(i)*15*s,i);}
  if(pattern===1){for(let row=0;row<2;row++)for(let i=-2;i<=2;i++)add(cx+i*spacing+(row?spacing*.35:0),base-row*spacing,i+row);}
  if(pattern===2){for(let i=-3;i<=3;i++)add(cx+i*spacing*.85,base-Math.abs(i)*spacing*.7,i);}
  if(pattern===3){for(let row=0;row<3;row++)for(let i=-1;i<=1;i++)add(cx+i*spacing,base-row*spacing,i+row);}
  waveTimer=clamp(5.8-wave*.12,3.3,5.8);
 }
 function characterCircles(){const circles=[];for(let i=3;i<25;i+=2){const n=simulation.nodes[i],p=project(n.p),edge=project(n.p.clone().add({x:.55,y:0,z:0}));circles.push({...p,r:Math.max(8,Math.abs(edge.x-p.x))*.84});}return circles;}
 function step(h){const oldX=bumper.x,oldY=bumper.y;
  if(keys.size){aim(bumper.tx+(Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')))*650*h,bumper.ty+(Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp')))*650*h);}
  const dx=bumper.tx-bumper.x,dy=bumper.ty-bumper.y,d=Math.hypot(dx,dy),move=Math.min(d,1600*h);if(d>.01){bumper.x+=dx/d*move;bumper.y+=dy/d*move;}
  bumper.vx=(bumper.x-oldX)/h;bumper.vy=(bumper.y-oldY)/h;bumper.tilt+=(clamp(bumper.vx/2200,-.35,.35)-bumper.tilt)*.18;
  advanceObstacles(objects,bumper,h,o=>{score++;pressure=Math.min(1,pressure+.05);bumper.impact=.18;emit(o.x,o.y,o.color);});
  const body=characterCircles();for(const o of objects)if(touchesCharacter(o,body)){leak({x:o.x,y:o.y});o.vx+=(o.x<innerWidth/2?-1:1)*95;o.vy=-100;break;}
  objects=objects.filter(o=>o.x>-o.r*3&&o.x<innerWidth+o.r*3&&o.y<innerHeight+o.r*3&&o.y>-innerHeight*2);
 }
 function drawObject(o){ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.angle);const r=o.r;ctx.fillStyle=o.color;ctx.strokeStyle='#273936';ctx.lineWidth=2.3;ctx.lineJoin='round';ctx.beginPath();
  if(o.type==='clock'){ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(0,-r*.55);ctx.lineTo(0,0);ctx.lineTo(r*.4,r*.18);ctx.stroke();}
  else{ctx.roundRect(-r*.84,-r*.84,r*1.68,r*1.68,4);ctx.fill();ctx.stroke();ctx.beginPath();if(o.type==='mail'){ctx.moveTo(-r*.8,-r*.7);ctx.lineTo(0,r*.06);ctx.lineTo(r*.8,-r*.7);}else if(o.type==='calendar'){ctx.moveTo(-r*.8,-r*.32);ctx.lineTo(r*.8,-r*.32);ctx.moveTo(-r*.4,-r);ctx.lineTo(-r*.4,-r*.6);ctx.moveTo(r*.4,-r);ctx.lineTo(r*.4,-r*.6);}else{for(let y=-.4;y<.5;y+=.3){ctx.moveTo(-r*.45,r*y);ctx.lineTo(r*.4,r*y);}}ctx.stroke();}
  if(o.type==='calendar'){ctx.font=`bold ${r*.55}px sans-serif`;ctx.textAlign='center';ctx.fillStyle='#273936';ctx.fillText('9:00',0,r*.47);}ctx.restore();
 }
 function drawBumper(){const r=bumper.r*(1+bumper.impact*.5);ctx.save();ctx.translate(bumper.x,bumper.y);
  ctx.beginPath();ctx.arc(0,0,r+5,0,Math.PI*2);ctx.fillStyle='#fff9e930';ctx.fill();ctx.strokeStyle='#273e3c';ctx.lineWidth=1.5;ctx.stroke();
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle='#fff9e94d';ctx.fill();ctx.strokeStyle='#fffdf2';ctx.lineWidth=5;ctx.stroke();
  ctx.beginPath();ctx.arc(-r*.08,-r*.08,r*.72,Math.PI*1.08,Math.PI*1.55);ctx.strokeStyle='#ffffffb0';ctx.lineWidth=2;ctx.stroke();
  if(!aimSeen&&elapsed<4){ctx.fillStyle='#273936';ctx.font='12px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText('← 移动鼠标保护他 →',0,r+28);}
  ctx.restore();
 }
 function draw(dt){ctx.clearRect(0,0,innerWidth,innerHeight);objects.forEach(drawObject);
  if(['playing','paused'].includes(phase))drawBumper();
  if(phase==='playing'){for(const p of sparks){p.t-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=220*dt;ctx.globalAlpha=clamp(p.t*3,0,1);ctx.fillStyle=p.color;ctx.strokeStyle='#273936';ctx.lineWidth=1;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.t*9);ctx.fillRect(-3,-2,6,4);ctx.strokeRect(-3,-2,6,4);ctx.restore();}sparks=sparks.filter(p=>p.t>0);ctx.globalAlpha=1;}
  if(leakFlash>0){const h=project(simulation.nodes[24].p);ctx.strokeStyle='#6a9e99';ctx.lineWidth=2;for(let i=0;i<5;i++){const a=-.8+i*.4,d=(.65-leakFlash)*100;ctx.beginPath();ctx.moveTo(h.x+Math.cos(a)*d,h.y-25+Math.sin(a)*d);ctx.lineTo(h.x+Math.cos(a)*(d+12),h.y-25+Math.sin(a)*(d+12));ctx.stroke();}}

 }
 return {get active(){return active;},get paused(){return active&&phase==='paused';},update(dt){if(!active)return;positionCamera();if(phase==='playing'){elapsed+=dt;waveTimer-=dt;sinceHit+=dt;leakCooldown=Math.max(0,leakCooldown-dt);leakFlash=Math.max(0,leakFlash-dt);if(sinceHit>3)pressure=Math.min(1,pressure+dt*.03);simulation.target=pressure;if(waveTimer<=0)spawnWave();acc+=Math.min(dt,.05);while(acc>=1/120&&phase==='playing'){step(1/120);acc-=1/120;}bumper.impact=Math.max(0,bumper.impact-dt);}draw(dt);if(phase==='playing'){toastTime-=dt;}const air=Math.round(pressure*100);$('[data-air-value]').textContent=air+'%';$('.game-air i').style.width=air+'%';$('.game-air [role=meter]').setAttribute('aria-valuenow',String(air));$('[data-air-hint]').textContent=air<20?'软下来也没关系，推开落物就能补气':sinceHit<3?'漏气中 · 推开落物可补气':'挡住压力，慢慢回气';$('.game-air').classList.toggle('low',air<30);$('.game-toast').style.opacity=toastTime>0?'1':'0';$('[data-time]').textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;$('[data-score]').textContent=score;$('[data-wave]').textContent=String(wave||1).padStart(2,'0');}};
}
