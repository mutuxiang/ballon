import * as THREE from 'three';
import {spriteBounds} from './game-art.js';
import {extractVesselOutline,OutlineCollider,SpriteProjection,SpriteVesselPhysics} from './sprite-collision.js';

export const THEME_ATLAS='./break-skin-atlas-v1.png';
export const WIND_ATLAS='./wind-skin-atlas-v1.png';
export const THEME_STORAGE_KEY='air-worker-theme';
export const THEMES=[
  {id:'none',name:'原始小人',note:'收起装饰，继续营业',row:-1},
  {id:'fishing',name:'摸鱼',note:'没法下班，先下水',row:0},
  {id:'breathe',name:'顺气',note:'争气的事等会儿，先顺口气',row:1},
  {id:'fresh',name:'散班味',note:'班照常上，味别太上头',row:2},
  {id:'tea',name:'续命',note:'工作不能泡汤，我可以先泡会儿',row:3},
  {id:'wind',name:'放风',note:'人不能随便走，风可以',row:0,atlas:WIND_ATLAS,columns:3,rows:3}
];

// Original imagegen artwork remains on sprites. Only annotated hollow vessels
// participate in screen-space contacts; front-wall occlusion is independent.
const PARTS={
  fishing:[
    {cell:0,size:4.6,position:[0,1.65,0],container:'bowl'},
    {cell:1,size:1.65,anchor:'face',position:[.12,4.75,.77]},
    {cell:2,size:.85,position:[-1.85,4.8,0],float:.12},
    {cell:3,size:1.15,position:[1.82,2.65,1.6]}
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
    {cell:15,size:4.6,position:[.2,.12,1.55],ground:.02,order:3},
    {cell:12,size:4.85,position:[.4,1.68,0],container:'cup'},
    {cell:13,size:.9,position:[-1.05,1.9,1.5]},
    {cell:14,size:1.7,position:[1.65,4.6,-.2],float:.1}
  ],
  wind:[
    {cell:0,size:4.55,position:[1.6,3.15,-1.6]},
    {cell:1,size:1.6,position:[2.2,5.75,-.2],float:.12},
    {cell:2,size:.65,anchor:'hand',position:[0,.06,.35]},
    {cell:4,size:1.9,anchor:'body',position:[-1.12,3.82,.8],swing:.07},
    {cell:3,size:1.4,anchor:'body',position:[0,3.82,.84]},
    {cell:5,size:1.9,anchor:'body',position:[-1,2.7,.8]},
    {cell:6,size:.95,position:[-2.2,4.9,-.5],float:.08},
    {cell:7,size:1.3,position:[-2.25,2.2,0],float:.15},
    {cell:8,size:1.35,position:[2.9,3.8,0],float:.1}
  ]
};

const ATLASES={base:{url:THEME_ATLAS,columns:4,rows:4},wind:{url:WIND_ATLAS,columns:3,rows:3}};
// Near rim measured in the generated cell's visible bounds (top-down UV).
// Its elliptical edge divides rear lip/liquid from the foreground vessel wall.
export const CONTAINER_RIMS={bowl:[.5,.085,.34,.075],cup:[.40,.13,.38,.14]};
function partitionContainer(material,kind,layer){
  const rim=CONTAINER_RIMS[kind];
  material.onBeforeCompile=shader=>{
    shader.uniforms.themeRim={value:new THREE.Vector4(...rim)};
    shader.uniforms.themeFront={value:layer==='front'?1:0};
    shader.vertexShader='varying vec2 vThemeUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvThemeUv=uv;');
    shader.fragmentShader='varying vec2 vThemeUv;\nuniform vec4 themeRim;\nuniform float themeFront;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float rimX=(vThemeUv.x-themeRim.x)/themeRim.z;
      float nearEdge=themeRim.y+themeRim.w*sqrt(max(0.0,1.0-rimX*rimX));
      bool isFront=(1.0-vThemeUv.y)>=nearEdge;
      if(isFront!=(themeFront>0.5))discard;
    `);
  };
  material.customProgramCacheKey=()=>`theme-container-${kind}-${layer}`;
}

// Keep both layers pixel-aligned even in the rotatable perspective preview.
// Moving along the view ray and compensating scale changes depth only.
export function placeContainerLayer(sprite,center,size,camera,depth){
  const view=center.clone().applyMatrix4(camera.matrixWorldInverse);
  const factor=camera.isPerspectiveCamera?Math.max(.05,(-view.z-depth)/Math.max(.01,-view.z)):1;
  sprite.position.copy(center);
  if(camera.isPerspectiveCamera){
    const eye=camera.getWorldPosition(new THREE.Vector3());sprite.position.sub(eye).multiplyScalar(factor).add(eye);
  }else sprite.position.addScaledVector(new THREE.Vector3(0,0,1).applyQuaternion(camera.quaternion),depth);
  sprite.scale.set(size.x*factor,size.y*factor,1);
}

export function createThemeSkins(scene,character,camera,{
  loadTexture=(url,onLoad,onError)=>new THREE.TextureLoader().load(url,onLoad,undefined,onError),
  reducedMotion=false
}={}){
  const root=new THREE.Group();root.name='Theme_accessories';scene.add(root);
  const groups=new Map(),entries=[],listeners=new Set();
  let active='none',age=0,disposed=false,status='loading',pending=Object.keys(ATLASES).length,failed=false,simulation=null,kickDirection=1;
  const collision=new SpriteVesselPhysics(character,camera,container);
  function container(){
    const entry=entries.find(e=>e.id===active&&e.part.container&&e.layer==='front');
    if(!entry?.collider)return null;
    character.updateWorldMatrix(true,false);
    return {collider:entry.collider,center:character.localToWorld(new THREE.Vector3(...entry.part.position))};
  }
  function connect(){if(simulation)simulation.environment=container()?collision:null;}
  const textures=new Map();
  for(const [key,atlas] of Object.entries(ATLASES)){
    const texture=loadTexture(atlas.url,loaded=>onLoad(loaded,key),()=>{failed=true;status='error';notify();});
    texture.colorSpace=THREE.SRGBColorSpace;textures.set(key,texture);
  }
  const world=new THREE.Vector3(),above=new THREE.Vector3(),towardCamera=new THREE.Vector3();
  function notify(){listeners.forEach(fn=>fn(active,status));}
  function onLoad(loaded,atlasKey){
    if(disposed)return;
    const image=loaded.image,canvas=document.createElement('canvas');
    canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const {columns,rows}=ATLASES[atlasKey];
    for(const entry of entries){
      if(entry.atlasKey!==atlasKey)continue;
      const {cell,size}=entry.part,col=cell%columns,row=Math.floor(cell/columns);
      const x=Math.floor(col*canvas.width/columns),y=Math.floor(row*canvas.height/rows);
      const bounds=spriteBounds(pixels,canvas.width,x,y,Math.floor((col+1)*canvas.width/columns)-x,Math.floor((row+1)*canvas.height/rows)-y);
      if(!bounds){entry.sprite.visible=false;continue;}
      entry.map.repeat.set(bounds.width/canvas.width,bounds.height/canvas.height);
      entry.map.offset.set(bounds.x/canvas.width,1-(bounds.y+bounds.height)/canvas.height);
      entry.map.needsUpdate=true;
      const factor=size/Math.max(bounds.width,bounds.height);
      entry.size.set(bounds.width*factor,bounds.height*factor);entry.sprite.scale.set(entry.size.x,entry.size.y,1);
      if(entry.part.container&&entry.layer==='front')entry.collider=new OutlineCollider(extractVesselOutline(pixels,canvas.width,bounds,entry.part.container),entry.size.x,entry.size.y);
    }
    connect();
    pending--;status=failed?'error':pending===0?'ready':'loading';notify();
  }
  for(const [id,parts] of Object.entries(PARTS)){
    const group=new THREE.Group();group.name='Theme_'+id;group.visible=false;root.add(group);groups.set(id,group);
    const atlasKey=id==='wind'?'wind':'base',{columns,rows}=ATLASES[atlasKey];
    for(const part of parts)for(const layer of part.container?['rear','front']:['single']){
      const map=textures.get(atlasKey).clone();map.repeat.set(1/columns,1/rows);map.offset.set(part.cell%columns/columns,1-(Math.floor(part.cell/columns)+1)/rows);
      map.minFilter=THREE.LinearFilter;map.generateMipmaps=false;
      const material=new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,alphaTest:.015});
      const suffix=(id==='wind'?'wind_':'')+part.cell+(layer==='single'?'':'_'+layer);
      const sprite=new THREE.Sprite(material);sprite.name='Theme_cell_'+suffix;sprite.scale.set(part.size,part.size,1);
      sprite.renderOrder=part.order??(layer==='rear'?2:part.anchor?6:4);
      // Erase the character mask behind opaque props, using the exact same
      // alpha/depth as the color pass. Otherwise its outline shows through cups.
      const maskMaterial=new THREE.SpriteMaterial({map,color:0x000000,transparent:true,depthWrite:false,alphaTest:.015});
      maskMaterial.allowOverride=false;
      if(part.container){partitionContainer(material,part.container,layer);partitionContainer(maskMaterial,part.container,layer);}
      // A screen-space front wall must still cover submerged sections when
      // depth motion brings them closer to the camera than the billboard plane.
      if(part.container&&layer==='front'){material.depthTest=false;maskMaterial.depthTest=false;}
      const mask=new THREE.Sprite(maskMaterial);mask.name='Theme_occluder_'+suffix;mask.layers.set(1);mask.renderOrder=sprite.renderOrder;
      sprite.add(mask);group.add(sprite);entries.push({part,sprite,map,mask,id,atlasKey,layer,size:new THREE.Vector2(part.size,part.size)});
    }
  }
  const stringGeometry=new THREE.BufferGeometry();stringGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(33*3),3));
  const kiteString=new THREE.Line(stringGeometry,new THREE.LineBasicMaterial({color:'#343532',transparent:true,depthWrite:false}));
  kiteString.name='Theme_kite_string';kiteString.frustumCulled=false;kiteString.renderOrder=5;groups.get('wind').add(kiteString);
  return {
    get active(){return active;},get status(){return status;},
    get physics(){return collision;},
    bind(sim){if(simulation?.environment===collision)simulation.environment=null;simulation=sim;connect();},
    nudge(){
      const current=container();if(!simulation||!current)return false;
      const projection=new SpriteProjection(character,camera,current.center);kickDirection*=-1;
      simulation.nodes.slice(3).forEach((node,i)=>{const old=projection.project(node.old);old.x-=kickDirection*.05*(i+1)/22;node.old.copy(projection.unproject(old,old.z));});return true;
    },
    subscribe(fn){listeners.add(fn);fn(active,status);return ()=>listeners.delete(fn);},
    select(id){
      if(disposed||!THEMES.some(theme=>theme.id===id))return false;
      if(active!==id)collision.reset();active=id;age=0;for(const [key,group] of groups)group.visible=key===id;connect();
      notify();return true;
    },
    update(dt,sim){
      if(disposed||active==='none')return;
      if(simulation!==sim){simulation=sim;connect();}
      age+=Math.max(0,Math.min(dt,.1));character.updateWorldMatrix(true,false);camera.updateWorldMatrix(true,false);
      towardCamera.set(0,0,1).applyQuaternion(camera.quaternion);
      for(const {part,sprite,mask,id,layer,size} of entries){
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
          rotation=reducedMotion?0:Math.sin(age*3)*(part.swing||0);
        }else{
          const baseY=part.ground===undefined?y:part.ground+size.y/2;
          world.set(x,baseY+(reducedMotion?0:Math.sin(age*1.5+part.cell)* (part.float||0)),z);character.localToWorld(world);
        }
        if(part.container)placeContainerLayer(sprite,world,size,camera,layer==='front'?1.3:-1.3);
        else sprite.position.copy(world);
        if(part.anchor==='body'&&part.swing&&!reducedMotion)rotation+=Math.sin(age*2)*part.swing;
        sprite.material.rotation=mask.material.rotation=rotation;
      }
      if(active==='wind'){
        const reel=root.getObjectByName('Theme_cell_wind_2'),kite=root.getObjectByName('Theme_cell_wind_1');
        const from=reel.position.clone(),to=kite.position.clone().add(new THREE.Vector3(0,-.5,0).applyQuaternion(camera.quaternion));
        const mid=from.clone().lerp(to,.5).add(new THREE.Vector3(-.32,-.12,.08));
        const curve=new THREE.QuadraticBezierCurve3(from,mid,to),positions=stringGeometry.attributes.position;
        for(let i=0;i<positions.count;i++){const p=curve.getPoint(i/(positions.count-1));positions.setXYZ(i,p.x,p.y,p.z);}positions.needsUpdate=true;
      }
    },
    dispose(){
      if(disposed)return;disposed=true;root.removeFromParent();
      if(simulation?.environment===collision)simulation.environment=null;
      entries.forEach(({sprite,map,mask})=>{map.dispose();sprite.material.dispose();mask.material.dispose();});textures.forEach(texture=>texture.dispose());stringGeometry.dispose();kiteString.material.dispose();listeners.clear();
    }
  };
}
