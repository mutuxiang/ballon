import {createMangaMotion} from './manga-motion.js';
import {createFocusManga} from './focus-manga.js';
import {createThemeSkins,THEMES} from './theme-skins.js';
import {mountThemePicker} from './theme-picker.js';
import {mountPedals} from './pedals.js';
import {mountPetTasks} from './pet-tasks.js';
import {mountSkinUnlockProgress} from './skin-unlocks.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createDancer} from './model.mjs';
import {AirPhysics} from './physics.js';
import {SilhouetteEffect} from './silhouette.js';
import {applyToon} from './toon.js';
import {createSkins} from './skins.js';
import {createClothing} from './clothing.js';
import {createComicHatching} from './comic.js';
import {createSkinGradient} from './skin-gradient.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import './skins.css';
import {mountTodayAvatar} from './today-avatar.js';
import {createTodayAppearance,mountStoredAppearance} from './today-appearance.js';

const stage=document.querySelector('#stage');
const petMode=new URLSearchParams(location.search).has('pet');
const petSizes=[.5,.75,1,1.25,1.5];
let petScale=1;
if(petMode)try{
  const savedScale=Number(localStorage.getItem('air-worker-pet-size'));
  if(petSizes.includes(savedScale))petScale=savedScale;
}catch{}
if(petMode){document.documentElement.classList.add('desktop-pet');const style=document.createElement('style');style.textContent='html.desktop-pet,html.desktop-pet body{background:transparent!important;overflow:hidden} .desktop-pet main{min-height:0;height:100vh} .desktop-pet header,.desktop-pet .intro,.desktop-pet .hint,.desktop-pet .air-states,.desktop-pet .controls,.desktop-pet #progress{display:none!important}';document.head.append(style);}
const scene=new THREE.Scene();
scene.background=new THREE.Color('#edf0eb');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
if(petMode){scene.background=null;renderer.setClearColor(0,0);}
renderer.setPixelRatio(Math.min(devicePixelRatio,petMode?1.5:2));
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
}});
const focusManga=createFocusManga(scene,character,camera);
const effect=new SilhouetteEffect(renderer,character);
const simulation=new AirPhysics(character,{seed:Date.now()>>>0,depthMotion:petMode?.32:1});
const themeSkins=createThemeSkins(scene,character,camera,{reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
themeSkins.bind(simulation);
const themePicker=mountThemePicker(document.querySelector('#air-states'),themeSkins);
// Start from the original appearance, then restore today's custom palette.
clothing.select('plain');skins.select('chill');skinGradient.setEnabled(true);
const todayAppearance=createTodayAppearance(character,skins,skinGradient);
const storedAppearance=mountStoredAppearance(todayAppearance);
function applyTodayAvatar(appearance){return storedAppearance.set(appearance);}
if(!petMode){
  const todayAvatar=mountTodayAvatar(document.querySelector('#air-states'),{onApply:applyTodayAvatar});
  document.querySelector('#air-states').prepend(todayAvatar.entry);
  if(new URLSearchParams(location.search).has('todayPhoto'))todayAvatar.open();
}
const download=document.querySelector('.download');
download.textContent='下载当前皮肤模型 ↗';download.title='导出当前表情、衣服与姿态；主题装饰和背景漫画效果不包含在 GLB 中';
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
    if(active!==id&&(active==='none'||id==='none'))simulation.mangaTransition=id==='none'?4:2.8;
    active=id;current=character;simulation.setState(id);
    for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.air===id));
    description.textContent=states[id].description;status.textContent=states[id].status;
    document.querySelector('.download').href='./'+states[id].file;
    play.disabled=false;speedInput.disabled=false;
    document.querySelector('#loading')?.remove();
    window.dancer={scene:character,simulation,state:id,skins,clothing,comic,skinGradient,themeSkins,selectTheme:themePicker.select};
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
function resize(){
  renderer.setSize(innerWidth,innerHeight);
  if(petMode){
    // Only the explicit size setting changes the established 50 pixels per world unit.
    camera.left=-innerWidth/(100*petScale);camera.right=-camera.left;
    camera.top=innerHeight/(100*petScale);camera.bottom=-camera.top;
    camera.zoom=1;
  }else camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize',resize);resize();
selectState('high');
const mangaMotion=createMangaMotion(camera);
const haloGeometry=new THREE.BufferGeometry(),haloPositions=[];
for(let i=0;i<28;i++){const a=i/28*Math.PI*2,r=.85+(i%3)*.05,R=r+.18+(i%4)*.09;haloPositions.push(Math.cos(a)*r,Math.sin(a)*r,0,Math.cos(a)*R,Math.sin(a)*R,0);}
haloGeometry.setAttribute('position',new THREE.Float32BufferAttribute(haloPositions,3));
const focusSprite=new THREE.LineSegments(haloGeometry,new THREE.LineBasicMaterial({color:0x242424}));focusSprite.visible=false;scene.add(focusSprite);
const pedals=mountPedals({selectState,simulation,camera});
const skinProgress=mountSkinUnlockProgress();
skinProgress.subscribe(state=>pedals.setTaskActive(Boolean(state.task)));
if(petMode)mountPetTasks(skinProgress,{anchor:()=>{
  const layouts={none:[0,0],fishing:[-3.8,4.7],breathe:[-.8,5.1],fresh:[-1.8,5],tea:[-3,4.8],wind:[-3.4,5.4]};
  const [offset,minHeight]=layouts[themeSkins.active]||layouts.none;
  const p=simulation.nodes[24].p.clone();
  if(themeSkins.active!=='none'){p.x=offset;p.y=Math.max(p.y,minHeight);}
  p.project(camera);
  return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
}});
addEventListener('air-pedal',event=>skinProgress.record(event.detail.side,event.detail.down,performance.now()/1000));
if(petMode&&window.desktopPet){
  window.desktopPet.onAction(({type,value})=>{
    if(type!=='today-appearance')return;
    try{applyTodayAvatar(value.appearance);window.desktopPet.appearanceApplied(value.id);}
    catch(error){window.desktopPet.appearanceApplied(value.id,error.message);}
  });
  const publishPetOptions=()=>window.desktopPet.configure({scale:petScale,theme:themeSkins.active,themes:THEMES.map(s=>({id:s.id,name:s.name})),unlocks:skinProgress.slots});
  themeSkins.subscribe(publishPetOptions);skinProgress.subscribe(publishPetOptions);
  window.desktopPet.onAction(({type,value})=>{if(type==='ink')focusSprite.material.color.set(value?0xf5f5ed:0x242424);if(type==='focus-end')pedals.cancelSuper();if(type==='pedal')pedals.set(value.side,value.down);if(type==='pedal-reset')pedals.reset();if(type==='air')selectState(value);if(type==='theme')themePicker.select(value);if(type==='pause')play.click();});
  window.desktopPet.onAction(({type,value})=>{
    if(type==='prop-nudge')themeSkins.nudge();
    if(type!=='size'||!petSizes.includes(value))return;
    petScale=value;
    try{localStorage.setItem('air-worker-pet-size',String(value));}catch{}
    resize();
  });
  renderer.domElement.addEventListener('contextmenu',e=>{e.preventDefault();window.desktopPet.menu();});
  const canvas=renderer.domElement;
  const body=simulation.nodes.slice(3);
  const arms=simulation.arms.flatMap(arm=>arm.nodes.slice(1));
  const projected=new THREE.Vector3();
  let dragPointer=null,previousPointer=null,dodged=false;

  function reactToApproach(event){
    const point={x:event.clientX,y:event.clientY};
    const previous=previousPointer;
    previousPointer=point;
    if(!previous)return;

    // Compare both mouse positions against the same pose so swaying alone cannot trigger a dodge.
    const pixelsPerUnit=innerWidth/(camera.right-camera.left);
    let gap=Infinity,previousGap=Infinity,closestX=0;
    function measure(node,radius){
      projected.copy(node.p).project(camera);
      const x=(projected.x+1)*innerWidth/2;
      const y=(1-projected.y)*innerHeight/2;
      const radiusPx=radius*pixelsPerUnit;
      const distance=Math.hypot(point.x-x,point.y-y)-radiusPx;
      if(distance<gap){gap=distance;closestX=x;}
      previousGap=Math.min(previousGap,Math.hypot(previous.x-x,previous.y-y)-radiusPx);
    }
    for(const node of body)measure(node,simulation.bodyRadius(node));
    for(const node of arms)measure(node,.12+.12*node.pressure);

    if(gap>32&&gap>previousGap)dodged=false;
    if(dodged||gap>16||previousGap-gap<1)return;
    const offset=point.x-closestX;
    const side=Math.abs(offset)>3?offset:previous.x-closestX;
    dodged=simulation.dodge(side<0?1:-1);
  }

  function endDrag(event){
    if(dragPointer===null||(event&&event.pointerId!==dragPointer))return;
    const pointerId=dragPointer;
    dragPointer=null;
    window.desktopPet.drag('end');
    if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);
  }

  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0||dragPointer!==null)return;
    dragPointer=event.pointerId;
    previousPointer=null;
    canvas.setPointerCapture(event.pointerId);
    window.desktopPet.drag('start');
  });
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerId===dragPointer){
      if(event.buttons&1)window.desktopPet.drag('move');
      else endDrag(event);
    }else if(dragPointer===null){
      if(playing&&event.pointerType==='mouse'&&event.buttons===0)reactToApproach(event);
      else previousPointer=null;
    }
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,endDrag);
  canvas.addEventListener('pointerleave',()=>{previousPointer=null;dodged=false;});
  window.addEventListener('blur',()=>{
    endDrag();
    previousPointer=null;
    dodged=false;
  });
}
let lastInkSample=0;
renderer.setAnimationLoop(()=>{
  const dt=Math.min(clock.getDelta(),.05);
  if(document.hidden)return;
  if(current&&playing)simulation.update(dt*speed);
  pedals.update(playing?dt*speed:0);
  skinGradient.update(simulation);skins.setFocus(simulation.superMode);
  focusManga.update(playing?dt*speed:0,simulation);
  focusSprite.visible=false;const focusFrame=simulation.sample(5.15);focusSprite.position.copy(focusFrame.c);focusSprite.position.z-=.8;
  if(simulation.superMode&&performance.now()-lastInkSample>700){lastInkSample=performance.now();const pos=focusSprite.position.clone().project(camera);window.desktopPet?.sample({x:(pos.x+1)*innerWidth/2,y:(1-pos.y)*innerHeight/2});}
  simulation.mangaTransition=Math.max(0,(simulation.mangaTransition||0)-(playing?dt*speed:0));
  const head=simulation.nodes[24],moving=head.p.distanceTo(head.old)>.0004,falling=head.p.y-head.old.y<-.0003;
  comic.setEnabled(!simulation.superMode&&simulation.mangaTransition>0&&moving&&falling&&head.p.y>.5);
  controls.update();comic.update(playing?dt*speed:0,simulation);themeSkins.update(playing?dt*speed:0,simulation);effect.render(scene,camera);mangaMotion.update(playing?dt*speed:0,simulation,focusSprite.material.color.getStyle());focusSprite.scale.setScalar(1+mangaMotion.burst*.28);
  document.querySelector('#progress').style.width=(simulation.nodes[24].pressure*100)+'%';
});

