import * as THREE from 'three';
import {spriteBounds} from './game-art.js';

export const THEME_ATLAS='./break-skin-atlas-v1.png';
export const THEME_STORAGE_KEY='air-worker-theme';
export const THEMES=[
  {id:'none',name:'原始小人',note:'收起装饰，继续营业',row:-1},
  {id:'fishing',name:'摸鱼',note:'没法下班，先下水',row:0},
  {id:'breathe',name:'顺气',note:'争气的事等会儿，先顺口气',row:1},
  {id:'fresh',name:'散班味',note:'班照常上，味别太上头',row:2},
  {id:'tea',name:'续命',note:'工作不能泡汤，我可以先泡会儿',row:3}
];

// Each entry addresses a generated atlas cell. The original meshes and solver
// remain untouched; accessories live outside the character's silhouette mask.
const PARTS={
  fishing:[
    {cell:0,size:4.6,position:[0,1.65,.85]},
    {cell:1,size:1.65,anchor:'face',position:[.12,4.75,.77]},
    {cell:2,size:.85,position:[-1.85,4.8,0],float:.12},
    {cell:3,size:1.15,position:[1.82,2.65,1]}
  ],
  breathe:[
    {cell:4,size:3.6,position:[0,.35,.8]},
    {cell:5,size:2.05,position:[-2.05,1,0]},
    {cell:6,size:2,position:[2.05,1,0]},
    {cell:7,size:1.35,position:[1.9,4.9,-.25],float:.1}
  ],
  fresh:[
    {cell:8,size:1.8,anchor:'hand',position:[.25,.55,.35],swing:.1},
    {cell:9,size:1.48,anchor:'body',position:[0,2.85,.75]},
    {cell:10,size:1.75,position:[-2.05,3.35,-.5],float:.1},
    {cell:11,size:1.6,position:[2.1,4.95,-.25],float:.12}
  ],
  tea:[
    {cell:15,size:4.6,position:[.2,.12,.4]},
    {cell:12,size:4.55,position:[.4,1.35,.95]},
    {cell:13,size:.9,position:[-1.05,1.6,1.05]},
    {cell:14,size:1.7,position:[1.65,4.6,-.2],float:.1}
  ]
};

export function createThemeSkins(scene,character,camera,{
  loadTexture=(url,onLoad,onError)=>new THREE.TextureLoader().load(url,onLoad,undefined,onError),
  reducedMotion=false
}={}){
  const root=new THREE.Group();root.name='Theme_accessories';scene.add(root);
  const groups=new Map(),entries=[],listeners=new Set();
  let active='none',age=0,disposed=false,status='loading';
  const texture=loadTexture(THEME_ATLAS,onLoad,()=>{status='error';notify();});
  texture.colorSpace=THREE.SRGBColorSpace;
  const world=new THREE.Vector3(),above=new THREE.Vector3(),towardCamera=new THREE.Vector3();
  function notify(){listeners.forEach(fn=>fn(active,status));}
  function onLoad(loaded){
    if(disposed)return;
    const image=loaded.image,canvas=document.createElement('canvas');
    canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    for(const entry of entries){
      const {cell,size}=entry.part,col=cell%4,row=Math.floor(cell/4);
      const x=Math.floor(col*canvas.width/4),y=Math.floor(row*canvas.height/4);
      const bounds=spriteBounds(pixels,canvas.width,x,y,Math.floor((col+1)*canvas.width/4)-x,Math.floor((row+1)*canvas.height/4)-y);
      if(!bounds){entry.sprite.visible=false;continue;}
      entry.map.repeat.set(bounds.width/canvas.width,bounds.height/canvas.height);
      entry.map.offset.set(bounds.x/canvas.width,1-(bounds.y+bounds.height)/canvas.height);
      entry.map.needsUpdate=true;
      const factor=size/Math.max(bounds.width,bounds.height);
      entry.sprite.scale.set(bounds.width*factor,bounds.height*factor,1);
    }
    status='ready';notify();
  }
  for(const [id,parts] of Object.entries(PARTS)){
    const group=new THREE.Group();group.name='Theme_'+id;group.visible=false;root.add(group);groups.set(id,group);
    for(const part of parts){
      const map=texture.clone();map.repeat.set(.25,.25);map.offset.set(part.cell%4/4,.75-Math.floor(part.cell/4)/4);
      map.minFilter=THREE.LinearFilter;map.generateMipmaps=false;
      const material=new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,alphaTest:.015});
      const sprite=new THREE.Sprite(material);sprite.name='Theme_cell_'+part.cell;sprite.scale.set(part.size,part.size,1);
      sprite.renderOrder=part.anchor?6:4;
      // Erase the character mask behind opaque props, using the exact same
      // alpha/depth as the color pass. Otherwise its outline shows through cups.
      const maskMaterial=new THREE.SpriteMaterial({map,color:0x000000,transparent:true,depthWrite:false,alphaTest:.015});
      maskMaterial.allowOverride=false;
      const mask=new THREE.Sprite(maskMaterial);mask.name='Theme_occluder_'+part.cell;mask.layers.set(1);mask.renderOrder=sprite.renderOrder;
      sprite.add(mask);group.add(sprite);entries.push({part,sprite,map,mask,id});
    }
  }
  return {
    get active(){return active;},get status(){return status;},
    subscribe(fn){listeners.add(fn);fn(active,status);return ()=>listeners.delete(fn);},
    select(id){
      if(disposed||!THEMES.some(theme=>theme.id===id))return false;
      active=id;age=0;for(const [key,group] of groups)group.visible=key===id;
      notify();return true;
    },
    update(dt,simulation){
      if(disposed||active==='none')return;
      age+=Math.max(0,Math.min(dt,.1));character.updateWorldMatrix(true,false);camera.updateWorldMatrix(true,false);
      towardCamera.set(0,0,1).applyQuaternion(camera.quaternion);
      for(const {part,sprite,mask,id} of entries){
        if(id!==active)continue;
        const [x,y,z]=part.position;
        let rotation=0;
        if(part.anchor==='face'||part.anchor==='body'){
          world.copy(simulation.bodyPosition(x,y,z));above.copy(simulation.bodyPosition(x,y+.2,z));
          character.localToWorld(world);character.localToWorld(above);
          const a=world.clone().project(camera),b=above.project(camera);
          rotation=Math.atan2(-(b.x-a.x)*camera.projectionMatrix.elements[5]/camera.projectionMatrix.elements[0],b.y-a.y);
          world.addScaledVector(towardCamera,.06);
        }else if(part.anchor==='hand'){
          world.copy(simulation.arms.find(arm=>arm.sign===1).nodes.at(-1).p).add(new THREE.Vector3(x,y,z));
          character.localToWorld(world);
          rotation=reducedMotion?0:Math.sin(age*3)*part.swing;
        }else{
          world.set(x,y+(reducedMotion?0:Math.sin(age*1.5+part.cell)* (part.float||0)),z);character.localToWorld(world);
        }
        sprite.position.copy(world);sprite.material.rotation=mask.material.rotation=rotation;
      }
    },
    dispose(){
      if(disposed)return;disposed=true;root.removeFromParent();
      entries.forEach(({sprite,map,mask})=>{map.dispose();sprite.material.dispose();mask.material.dispose();});texture.dispose();listeners.clear();
    }
  };
}
