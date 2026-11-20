import * as THREE from 'three';
import {spriteBounds} from './game-art.js';
import {extractVesselOutline,OutlineCollider,SpriteVesselPhysics} from './sprite-collision.js';

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
    {cell:0,size:5.4,position:[0,1.75,0],container:'bowl'},
    {cell:1,size:1.65,anchor:'face',position:[.12,4.75,.77]},
    {cell:2,size:.85,position:[-1.85,4.8,0],float:.12}
  ],
  breathe:[
    {cell:4,size:3,position:[0,.35,.8],ground:.02},
    {cell:5,key:'kettle',size:2.05,position:[-2.25,1,0],ground:.12},
    {cell:15,size:1.55,relative:'kettle',uv:[.5,1],pivot:[.5,.55],order:2,depth:-.01},
    {cell:6,size:2,position:[2.05,1,0],ground:.02},
    {cell:7,size:1.35,position:[1.9,4.9,-.25],float:.1},
    {cell:0,atlas:'pillow',key:'neck-pillow',size:1.7,anchor:'body',position:[0,3.87,0],wear:'pillow',pivot:[.5,.58]},
    {cell:0,atlas:'drink',key:'hand-drink',size:1,anchor:'hand',position:[0,0,.32],flipX:true,pivot:[.17,.65]}
  ],
  fresh:[
    {cell:8,size:1.8,anchor:'hand',position:[.25,.55,.35],swing:.1},
    {cell:9,size:1.48,anchor:'body',position:[0,2.85,.75]},
    {cell:10,size:1.75,position:[-2.05,3.35,-.5],float:.1},
    {cell:11,size:1.6,position:[2.1,4.95,-.25],float:.12}
  ],
  tea:[
    {cell:12,key:'tea-cup',size:4.85,position:[.4,1.68,0],container:'cup'},
    {cell:15,size:4.6,relative:'tea-cup',uv:[.4,.97],pivot:[.5,.55],order:3,depth:1},
    {cell:13,size:1.15,relative:'tea-cup',uv:[.2,.247],pivot:[.5,0],order:6,depth:1.4},
    {cell:14,size:1.7,position:[1.65,4.6,-.2],float:.1}
  ],
  wind:[
    {cell:0,size:4.55,position:[1.6,3.15,-1.6]},
    {cell:1,size:1.6,position:[2.2,5.75,-.2],float:.12},
    {cell:2,size:.65,anchor:'hand',position:[0,.06,.35]},
    {cell:4,size:1.8,anchor:'body',position:[-.52,3.87,.62],pivot:[1,.5],swing:.025},
    {cell:3,size:1.4,anchor:'body',position:[0,3.87,0],wear:'scarf',pivot:[.5,.25]},
    {cell:5,size:1.8,anchor:'arm',position:[0,.13,0],wear:'bag',pivot:[.53,.18]},
    {cell:6,size:.95,position:[-2.2,4.9,-.5],float:.08},
    {cell:7,size:1.3,position:[-2.25,2.2,0],float:.15},
    {cell:8,size:1.35,position:[2.9,3.8,0],float:.1}
  ]
};

const ATLASES={base:{url:THEME_ATLAS,columns:4,rows:4},wind:{url:WIND_ATLAS,columns:3,rows:3},pillow:{url:'./relax-neck-pillow-v1.png',columns:1,rows:1},drink:{url:'./relax-hand-drink-v1.png',columns:1,rows:1}};
// Near rim measured in the generated cell's visible bounds (top-down UV).
// Its elliptical edge divides rear lip/liquid from the foreground vessel wall.
export const CONTAINER_RIMS={bowl:[.5,.085,.34,.075],cup:[.40,.13,.38,.14]};
function partitionContainer(material,kind,layer){
  const rim=CONTAINER_RIMS[kind];
  material.onBeforeCompile=shader=>{
    shader.uniforms.themeRim={value:new THREE.Vector4(...rim)};
    shader.uniforms.themeFront={value:layer==='front'?1:0};
    shader.uniforms.themeAge={value:0};shader.uniforms.themeRepeat={value:material.map.repeat};material.userData.themeShader=shader;
    shader.vertexShader='varying vec2 vThemeUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvThemeUv=uv;');
    shader.fragmentShader='varying vec2 vThemeUv;\nuniform vec4 themeRim;\nuniform float themeFront;\nuniform float themeAge;\nuniform vec2 themeRepeat;\n'+shader.fragmentShader;
    const water=kind==='bowl'?`
      vec2 topUv=vec2(vThemeUv.x,1.-vThemeUv.y);
      float fishA=1.-smoothstep(.55,1.,length((topUv-vec2(.20,.54))/vec2(.18,.13)));
      float fishB=1.-smoothstep(.55,1.,length((topUv-vec2(.74,.60))/vec2(.17,.12)));
      float weedA=1.-smoothstep(.5,1.,length((topUv-vec2(.23,.84))/vec2(.18,.17)));
      float weedB=1.-smoothstep(.5,1.,length((topUv-vec2(.81,.81))/vec2(.13,.19)));
      vec2 shift=vec2(.006*sin(themeAge*.9),.003*sin(themeAge*1.2))*fishA+vec2(.005*sin(themeAge*.8+2.),.003*sin(themeAge+1.))*fishB;
      shift.x+=.007*sin(themeAge*1.1+topUv.y*5.)*(weedA+weedB)*(1.-smoothstep(.72,.98,topUv.y));
      vec2 animatedUv=vMapUv+shift*themeRepeat;
    `:'vec2 animatedUv=vMapUv;';
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',water+'\n'+THREE.ShaderChunk.map_fragment.replaceAll('vMapUv','animatedUv')+`
      float rimX=(vThemeUv.x-themeRim.x)/themeRim.z;
      float nearEdge=themeRim.y+themeRim.w*sqrt(max(0.0,1.0-rimX*rimX));
      bool isFront=(1.0-vThemeUv.y)>=nearEdge;
      if(isFront!=(themeFront>0.5))discard;
    `);
  };
  material.customProgramCacheKey=()=>`theme-container-${kind}-${layer}`;
}

function partitionWearable(material,kind,layer){
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 vWearUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvWearUv=uv;');
    const edge=kind==='scarf'?'v>.28+.16*sqrt(max(0.,1.-pow((vWearUv.x-.5)/.46,2.)))':kind==='bag'?'v>.45||vWearUv.x>.8':'v>.48';
    shader.fragmentShader='varying vec2 vWearUv;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>\nfloat v=1.-vWearUv.y;bool front=${edge};if(front!=${layer==='front'?'true':'false'})discard;`);
  };
  material.customProgramCacheKey=()=>`wear-${kind}-${layer}`;
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
      if(entry.part.flipX){entry.map.offset.x+=entry.map.repeat.x;entry.map.repeat.x*=-1;}
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
    for(const part of parts){
    const atlasKey=part.atlas||(id==='wind'?'wind':'base'),{columns,rows}=ATLASES[atlasKey];
    for(const layer of part.container||part.wear?['rear','front']:['single']){
      const map=textures.get(atlasKey).clone();map.repeat.set(1/columns,1/rows);map.offset.set(part.cell%columns/columns,1-(Math.floor(part.cell/columns)+1)/rows);
      map.minFilter=THREE.LinearFilter;map.generateMipmaps=false;
      const material=new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,alphaTest:.015});
      const suffix=(id==='wind'?'wind_':'')+(part.key||part.cell)+(layer==='single'?'':'_'+layer);
      const sprite=new THREE.Sprite(material);sprite.name='Theme_cell_'+suffix;sprite.scale.set(part.size,part.size,1);
      if(part.pivot)sprite.center.set(part.pivot[0],1-part.pivot[1]);
      sprite.renderOrder=part.order??(layer==='rear'?2:part.anchor?6:4);
      // Erase the character mask behind opaque props, using the exact same
      // alpha/depth as the color pass. Otherwise its outline shows through cups.
      const maskMaterial=new THREE.SpriteMaterial({map,color:0x000000,transparent:true,depthWrite:false,alphaTest:.015});
      maskMaterial.allowOverride=false;
      if(part.container){partitionContainer(material,part.container,layer);partitionContainer(maskMaterial,part.container,layer);}
      if(part.wear){partitionWearable(material,part.wear,layer);partitionWearable(maskMaterial,part.wear,layer);}
      // A screen-space front wall must still cover submerged sections when
      // depth motion brings them closer to the camera than the billboard plane.
      if(part.container&&layer==='front'){material.depthTest=false;maskMaterial.depthTest=false;}
      const mask=new THREE.Sprite(maskMaterial);mask.name='Theme_occluder_'+suffix;mask.layers.set(1);mask.renderOrder=sprite.renderOrder;
      mask.center.copy(sprite.center);
      if(part.relative){material.depthTest=false;maskMaterial.depthTest=false;}
      sprite.add(mask);group.add(sprite);entries.push({part,sprite,map,mask,id,atlasKey,layer,size:new THREE.Vector2(part.size,part.size),worldCenter:new THREE.Vector3()});
    }
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
      if(!simulation)return false;kickDirection*=-1;return collision.nudge(simulation,kickDirection);
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
      const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
      for(const entry of entries){
        const {part,sprite,mask,id,layer,size}=entry;
        if(id!==active)continue;
        const [x,y,z]=part.position||[0,0,0];
        let rotation=0;
        if(part.relative){
          const parent=entries.find(e=>e.id===id&&e.part.key===part.relative&&e.layer!=='rear');
          world.copy(parent.worldCenter).addScaledVector(right,(part.uv[0]-.5)*parent.size.x).addScaledVector(up,(.5-part.uv[1])*parent.size.y);
        }else if(part.anchor==='face'||part.anchor==='body'){
          world.copy(simulation.bodyPosition(x,y,z));above.copy(simulation.bodyPosition(x,y+.2,z));
          character.localToWorld(world);character.localToWorld(above);
          const a=world.clone().project(camera),b=above.project(camera);
          rotation=Math.atan2(-(b.x-a.x)*camera.projectionMatrix.elements[5]/camera.projectionMatrix.elements[0],b.y-a.y);
          world.addScaledVector(towardCamera,.06);
        }else if(part.anchor==='arm'){
          world.copy(simulation.arms[0].nodes[3].p).add(new THREE.Vector3(x,y,z));character.localToWorld(world);
          rotation=THREE.MathUtils.clamp((simulation.arms[0].nodes[5].p.y-simulation.arms[0].nodes[1].p.y)*.12,-.18,.18);
        }else if(part.anchor==='hand'){
          world.copy(simulation.arms.find(arm=>arm.sign===1).nodes.at(-1).p).add(new THREE.Vector3(x,y,z));
          character.localToWorld(world);
          rotation=reducedMotion?0:Math.sin(age*3)*(part.swing||0);
        }else{
          const baseY=part.ground===undefined?y:part.ground+size.y/2;
          world.set(x,baseY+(reducedMotion?0:Math.sin(age*1.5+part.cell)* (part.float||0)),z);character.localToWorld(world);
        }
        entry.worldCenter.copy(world);
        if(part.container)placeContainerLayer(sprite,world,size,camera,layer==='front'?1.3:-1.3);
        else if(part.relative)placeContainerLayer(sprite,world,size,camera,part.depth||0);
        else if(part.wear){
          const pressure=simulation.sample(y||3.87).p;
          // A padded neck pillow retains its volume when the wearer deflates.
          // Keep its front lobes beyond the neck even when it folds sideways.
          const scale=part.wear==='bag'?1:part.wear==='pillow'?.82+.18*pressure:.52+.48*pressure;
          const depth=part.wear==='bag'?.38:part.wear==='pillow'?.5+.4*pressure:.2+.65*pressure;
          if(part.wear==='pillow'&&layer==='front'){
            // The deflated torso folds across the billboard plane. Its front
            // lobes still sit over the neck, while the rear band stays behind.
            // Hysteresis avoids flickering during pressure fluctuations.
            if(pressure<.4)sprite.material.depthTest=mask.material.depthTest=false;
            else if(pressure>.55)sprite.material.depthTest=mask.material.depthTest=true;
          }
          placeContainerLayer(sprite,world,size.clone().multiplyScalar(scale),camera,layer==='front'?depth:-depth);
        }
        else sprite.position.copy(world);
        if(part.anchor==='body'&&part.swing&&!reducedMotion)rotation+=Math.sin(age*2)*part.swing;
        sprite.material.rotation=mask.material.rotation=rotation;
        for(const material of [sprite.material,mask.material])if(material.userData.themeShader)material.userData.themeShader.uniforms.themeAge.value=reducedMotion?0:age;
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
