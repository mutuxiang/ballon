import {createMangaMotion} from './manga-motion.js';
import {mountPedals} from './pedals.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createDancer} from './model.mjs';
import {AirPhysics} from './physics.js';
import {SilhouetteEffect} from './silhouette.js';
import {applyToon} from './toon.js';
import {createSkins,SKINS} from './skins.js';
import {createClothing,OUTFITS} from './clothing.js';
import {createComicHatching} from './comic.js';
import {createSkinGradient} from './skin-gradient.js';
import {createMotionExpressions} from './motion-expressions.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import './skins.css';

const stage=document.querySelector('#stage');
const petMode=new URLSearchParams(location.search).has('pet');
if(petMode){document.documentElement.classList.add('desktop-pet');const style=document.createElement('style');style.textContent='html.desktop-pet,html.desktop-pet body{background:transparent!important;overflow:hidden} .desktop-pet main{min-height:0;height:100vh} .desktop-pet header,.desktop-pet .intro,.desktop-pet .hint,.desktop-pet .air-states,.desktop-pet .controls,.desktop-pet #progress{display:none!important}';document.head.append(style);}
const scene=new THREE.Scene();
scene.background=new THREE.Color('#edf0eb');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:petMode});
if(petMode){scene.background=null;renderer.setClearColor(0,0);}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NoToneMapping;
stage.prepend(renderer.domElement);
const camera=petMode?new THREE.OrthographicCamera(-8,8,7,-.5,.1,100):new THREE.PerspectiveCamera(37,innerWidth/innerHeight,.1,100);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.minDistance=6;controls.maxDistance=24;controls.maxPolarAngle=Math.PI*.49;
function reset(){camera.position.set(petMode?0:2.4,petMode?3.2:4.5,14.3);controls.target.set(petMode?0:.4,petMode?3.2:2.7,0);controls.update();}
reset();
if(petMode)controls.enabled=false;
// No lights, specular highlights, shading bands, or cast shadows.
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshBasicMaterial({color:0xedf0eb}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.025;scene.add(floor);
const ring=new THREE.Mesh(new THREE.TorusGeometry(3.8,.012,6,128),new THREE.MeshBasicMaterial({color:0xc4cec0}));
ring.rotation.x=Math.PI/2;ring.position.y=-.02;scene.add(ring);
if(petMode){floor.visible=false;ring.visible=false;}

const states={
  none:{file:'air-dancer-none.glb',description:'彻底躺平。身体扁塌，手臂软软垂落。',status:'没气 · 躺平休息'},
  low:{file:'air-dancer-low.glb',description:'勉强撑着。半鼓起的身体，慢慢晃两下。',status:'气少 · 勉强营业'},
  high:{file:'air-dancer.glb',description:'气已充满。身体饱满，短手跟着一起摇摆。',status:'气多 · 摇摆营业'}
};
const character=createDancer({rest:true,separateFace:true}).group;
applyToon(character);scene.add(character);
const skins=createSkins(character);
const skinGradient=createSkinGradient(character,skins);
const comic=createComicHatching(scene,camera);
const clothing=createClothing(character,{onPaletteChange:palette=>{
  skins.setPalette(palette);
  document.documentElement.style.setProperty('--skin-tone',palette.skinColor);
  document.querySelectorAll('[data-skin] img').forEach((image,index)=>{image.src=skins.thumbnail(index);});
}});
const effect=new SilhouetteEffect(renderer,character);
const simulation=new AirPhysics(character,{seed:Date.now()>>>0,depthMotion:petMode?.32:1});
const outfitPanel=document.createElement('section');outfitPanel.className='outfit-picker';outfitPanel.setAttribute('aria-label','衣服风格');
outfitPanel.innerHTML='<div class="skin-heading"><h2>衣服风格</h2><span>独立搭配表情</span></div><div class="outfit-buttons"></div>';
document.querySelector('#air-states').append(outfitPanel);
for(const outfit of OUTFITS){
  const button=document.createElement('button');button.type='button';button.dataset.outfit=outfit.id;button.title=outfit.note;button.textContent=outfit.name;
  const swatches=document.createElement('span');swatches.className='outfit-swatches';swatches.setAttribute('aria-hidden','true');
  for(const color of outfit.swatches){const dot=document.createElement('i');dot.style.backgroundColor=color;swatches.append(dot);}button.append(swatches);
  button.onclick=()=>selectOutfit(outfit.id);outfitPanel.querySelector('.outfit-buttons').append(button);
}
function selectOutfit(id){
  if(!clothing.select(id))return;
  comic.setEnabled(id==='comic');
  skinGradient.setEnabled(true);
  for(const button of outfitPanel.querySelectorAll('[data-outfit]'))button.setAttribute('aria-pressed',String(button.dataset.outfit===id));
  try{localStorage.setItem('air-worker-outfit',id);}catch{}
}
let savedOutfit;try{savedOutfit=localStorage.getItem('air-worker-outfit');}catch{}
selectOutfit(OUTFITS.some(outfit=>outfit.id===savedOutfit)?savedOutfit:'plain');
const skinPanel=document.createElement('section');skinPanel.className='skin-picker';skinPanel.setAttribute('aria-label','表情皮肤');
skinPanel.innerHTML=`<div class="skin-heading"><h2>今天用哪张脸？</h2><span>原版 + ${SKINS.length-1} 款参考表情</span></div><div class="expression-mode-buttons" role="group" aria-label="表情模式"><button type="button" data-expression-mode="manual">手动选择</button><button type="button" data-expression-mode="motion" title="随实际运动切换，不使用原版表情；点击任意表情可恢复手动">随动作切换</button></div><div class="skin-grid"></div><p id="skin-description" aria-live="polite"></p>`;
document.querySelector('#air-states').append(skinPanel);
const skinGrid=skinPanel.querySelector('.skin-grid');
const motionExpressions=createMotionExpressions((id,reason)=>applySkin(id,reason));
let manualSkinId=SKINS[0].id;
SKINS.forEach((skin,index)=>{
  const button=document.createElement('button');button.type='button';button.dataset.skin=skin.id;button.setAttribute('aria-pressed','false');button.title=(index===0?'项目原版':'参考图 '+index)+' · '+skin.note;
  const image=document.createElement('img');image.src=skins.thumbnail(index);image.alt='';image.width=76;image.height=76;
  const label=document.createElement('span');label.textContent=skin.name;button.append(image,label);
  button.onclick=()=>selectSkin(skin.id);skinGrid.append(button);
});
function applySkin(id,reason=''){
  if(!skins.select(id))return false;
  for(const button of skinGrid.children)button.setAttribute('aria-pressed',String(button.dataset.skin===id));
  document.querySelector('#skin-description').textContent=(reason?reason+' · ':'')+SKINS.find(s=>s.id===id).note;
  return true;
}
function setExpressionMode(mode,{remember=true}={}){
  if(!['manual','motion'].includes(mode))return false;
  motionExpressions.setEnabled(mode==='motion',simulation);
  for(const button of skinPanel.querySelectorAll('[data-expression-mode]'))button.setAttribute('aria-pressed',String(button.dataset.expressionMode===mode));
  if(mode==='manual')applySkin(manualSkinId);
  if(remember)try{localStorage.setItem('air-worker-expression-mode',mode);}catch{}
  return true;
}
function selectSkin(id){
  if(!SKINS.some(s=>s.id===id))return;
  manualSkinId=id;setExpressionMode('manual');
  try{localStorage.setItem('air-worker-skin',id);}catch{/* Storage may be disabled. */}
}
for(const button of skinPanel.querySelectorAll('[data-expression-mode]'))button.onclick=()=>setExpressionMode(button.dataset.expressionMode);
let savedSkin,savedExpressionMode;try{savedSkin=localStorage.getItem('air-worker-skin');savedExpressionMode=localStorage.getItem('air-worker-expression-mode');}catch{}
manualSkinId=SKINS.some(s=>s.id===savedSkin)?savedSkin:SKINS[0].id;
applySkin(manualSkinId);setExpressionMode(savedExpressionMode==='motion'?'motion':'manual',{remember:false});
const download=document.querySelector('.download');
download.textContent='下载当前皮肤模型 ↗';download.title='导出当前表情、衣服与姿态；背景漫画线是页面动态效果，不包含在 GLB 中';
download.addEventListener('click',async event=>{
  event.preventDefault();if(download.getAttribute('aria-busy')==='true')return;
  download.setAttribute('aria-busy','true');download.textContent='正在导出…';
  try{
    const exportSkin=skins.active,exportOutfit=clothing.active,exportState=active;
    const buffer=await new GLTFExporter().parseAsync(character,{binary:true});
    const url=URL.createObjectURL(new Blob([buffer],{type:'model/gltf-binary'}));
    const link=document.createElement('a');link.href=url;link.download='air-worker-'+exportSkin+'-'+exportOutfit+'-'+exportState+'.glb';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  }catch(error){document.querySelector('#error').textContent='模型导出失败，请重试。';console.error(error);}
  finally{download.removeAttribute('aria-busy');download.textContent='下载当前皮肤模型 ↗';}
});
const buttons=[...document.querySelectorAll('[data-air]')];
const play=document.querySelector('#play'),speedInput=document.querySelector('#speed');
const description=document.querySelector('#state-description'),status=document.querySelector('#motion-status');
let current=null,playing=true,speed=1,active='high',busy=false;
const clock=new THREE.Clock();
async function selectState(id){
  if(busy)return;
  busy=true;
  for(const b of buttons)b.disabled=true;
  document.querySelector('#air-states').setAttribute('aria-busy','true');
  description.textContent='正在切换充气状态…';
  document.querySelector('#error').textContent='';
  try{
    if(active!==id&&(active==='none'||id==='none'))simulation.mangaTransition=2.8;
    active=id;current=character;simulation.setState(id);
    for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.air===id));
    description.textContent=states[id].description;status.textContent=states[id].status;
    document.querySelector('.download').href='./'+states[id].file;
    play.disabled=false;speedInput.disabled=false;
    document.querySelector('#loading')?.remove();
    window.dancer={scene:character,simulation,state:id,skins,selectSkin,clothing,selectOutfit,comic,skinGradient,motionExpressions,setExpressionMode};
  }catch(error){
    document.querySelector('#error').textContent='模型加载失败，请再次点击状态按钮重试。';
    description.textContent='切换失败，请重试。';console.error(error);
  }finally{
    busy=false;for(const b of buttons)b.disabled=false;
    document.querySelector('#air-states').setAttribute('aria-busy','false');
  }
}
for(const b of buttons)b.onclick=()=>selectState(b.dataset.air);
play.onclick=()=>{playing=!playing;play.textContent=playing?'暂停动画':'继续播放';play.setAttribute('aria-pressed',String(!playing));};
speedInput.oninput=e=>{speed=+e.target.value;document.querySelector('#speedVal').textContent=speed.toFixed(1)+'×';};
document.querySelector('#reset').onclick=reset;
function resize(){renderer.setSize(innerWidth,innerHeight);if(petMode){const h=Math.max(7.2,14.8*innerHeight/innerWidth);camera.left=-h*innerWidth/innerHeight/2;camera.right=-camera.left;camera.top=h/2;camera.bottom=-h/2;}else camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
selectState('high');
const mangaMotion=createMangaMotion(camera);
const haloGeometry=new THREE.BufferGeometry(),haloPositions=[];
for(let i=0;i<28;i++){const a=i/28*Math.PI*2,r=.85+(i%3)*.05,R=r+.18+(i%4)*.09;haloPositions.push(Math.cos(a)*r,Math.sin(a)*r,0,Math.cos(a)*R,Math.sin(a)*R,0);}
haloGeometry.setAttribute('position',new THREE.Float32BufferAttribute(haloPositions,3));
const focusSprite=new THREE.LineSegments(haloGeometry,new THREE.LineBasicMaterial({color:0x242424}));focusSprite.visible=false;scene.add(focusSprite);
const pedals=mountPedals({selectState,simulation,petMode,camera});
if(petMode&&window.desktopPet){
  window.desktopPet.configure({skins:SKINS.map(s=>({id:s.id,name:s.name})),outfits:OUTFITS.map(s=>({id:s.id,name:s.name}))});
  window.desktopPet.onAction(({type,value})=>{if(type==='ink')focusSprite.material.color.set(value?0xf5f5ed:0x242424);if(type==='focus-end')pedals.cancelSuper();if(type==='pedal')pedals.set(value.side,value.down);if(type==='pedal-reset')pedals.reset();if(type==='air')selectState(value);if(type==='skin')selectSkin(value);if(type==='outfit')selectOutfit(value);if(type==='motion')setExpressionMode(value?'motion':'manual');if(type==='pause')play.click();});
  renderer.domElement.addEventListener('contextmenu',e=>{e.preventDefault();window.desktopPet.menu();});
  let dragging=false;
  renderer.domElement.addEventListener('pointerdown',e=>{if(e.button===0){dragging=true;renderer.domElement.setPointerCapture(e.pointerId);window.desktopPet.drag('start');}});
  renderer.domElement.addEventListener('pointermove',()=>{if(dragging)window.desktopPet.drag('move');});
  renderer.domElement.addEventListener('pointerup',()=>{dragging=false;window.desktopPet.drag('end');});
}
let lastInkSample=0;
renderer.setAnimationLoop(()=>{
  const dt=Math.min(clock.getDelta(),.05);
  if(current&&playing)simulation.update(dt*speed);
  motionExpressions.update(playing?dt*speed:0,simulation);
  pedals.update(playing?dt*speed:0);
  skinGradient.update(simulation);skins.setFocus(simulation.superMode);
  focusSprite.visible=Boolean(simulation.superMode);const focusFrame=simulation.sample(5.15);focusSprite.position.copy(focusFrame.c);focusSprite.position.z-=.8;
  if(simulation.superMode&&performance.now()-lastInkSample>700){lastInkSample=performance.now();const pos=focusSprite.position.clone().project(camera);window.desktopPet?.sample({x:(pos.x+1)*innerWidth/2,y:(1-pos.y)*innerHeight/2});}
  simulation.mangaTransition=Math.max(0,(simulation.mangaTransition||0)-(playing?dt*speed:0));
  const head=simulation.nodes[24],moving=head.p.distanceTo(head.old)>.0004,falling=head.p.y-head.old.y<-.0003;
  comic.setEnabled(!simulation.superMode&&simulation.mangaTransition>0&&moving&&falling&&head.p.y>.5);
  controls.update();comic.update(playing?dt*speed:0,simulation);effect.render(scene,camera);mangaMotion.update(playing?dt*speed:0,simulation,focusSprite.material.color.getStyle());focusSprite.scale.setScalar(1+mangaMotion.burst*.28);
  document.querySelector('#progress').style.width=(simulation.nodes[24].pressure*100)+'%';
});

