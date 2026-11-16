import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OutlineEffect} from 'three/addons/effects/OutlineEffect.js';
import {applyToon} from './toon.js';

const stage=document.querySelector('#stage');
const scene=new THREE.Scene();
scene.background=new THREE.Color('#edf0eb');
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NoToneMapping;
stage.prepend(renderer.domElement);
const effect=new OutlineEffect(renderer);
const camera=new THREE.PerspectiveCamera(37,innerWidth/innerHeight,.1,100);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.minDistance=6;controls.maxDistance=24;controls.maxPolarAngle=Math.PI*.49;
function reset(){camera.position.set(2.4,4.5,14.3);controls.target.set(.4,2.7,0);controls.update();}
reset();
// No lights, specular highlights, shading bands, or cast shadows.
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshBasicMaterial({color:0xedf0eb}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.025;scene.add(floor);
const ring=new THREE.Mesh(new THREE.TorusGeometry(3.8,.012,6,128),new THREE.MeshBasicMaterial({color:0xc4cec0}));
ring.rotation.x=Math.PI/2;ring.position.y=-.02;scene.add(ring);
for(const o of [floor,ring])o.material.userData.outlineParameters={visible:false};

const states={
  none:{file:'air-dancer-none.glb',description:'彻底躺平。身体扁塌，手臂软软垂落。',status:'没气 · 躺平休息'},
  low:{file:'air-dancer-low.glb',description:'勉强撑着。半鼓起的身体，慢慢晃两下。',status:'气少 · 勉强营业'},
  high:{file:'air-dancer.glb',description:'气已充满。身体饱满，短手跟着一起摇摆。',status:'气多 · 摇摆营业'}
};
const cache=new Map(),loader=new GLTFLoader();
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
    let entry=cache.get(id);
    if(!entry){
      const gltf=await loader.loadAsync('./'+states[id].file+'?v=flat-states-5');
      applyToon(gltf.scene);
      gltf.scene.traverse(o=>{if(o.isMesh)o.frustumCulled=false;});
      const mixer=new THREE.AnimationMixer(gltf.scene),action=gltf.animations.length?mixer.clipAction(gltf.animations[0]):null;
      entry={root:gltf.scene,mixer,action,clip:gltf.animations[0]};
      cache.set(id,entry);
    }
    if(current)scene.remove(current.root);
    current=entry;active=id;
    current.action?.reset().play();current.mixer.update(0);
    scene.add(current.root);
    for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.air===id));
    description.textContent=states[id].description;status.textContent=states[id].status;
    document.querySelector('.download').href='./'+states[id].file;
    play.disabled=id==='none';speedInput.disabled=id==='none';
    document.querySelector('#loading')?.remove();
    window.dancer={scene:current.root,mixer:current.mixer,action:current.action,clip:current.clip,state:id};
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
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
selectState('high');
renderer.setAnimationLoop(()=>{
  const dt=Math.min(clock.getDelta(),.05);
  if(current&&playing&&active!=='none')current.mixer.update(dt*speed);
  controls.update();effect.render(scene,camera);
  document.querySelector('#progress').style.width=current&&active!=='none'?(current.action.time/current.clip.duration*100)+'%':'0%';
});

