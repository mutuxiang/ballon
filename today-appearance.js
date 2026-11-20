import * as THREE from 'three';
import {normalizeAppearance,APPEARANCE_KEY,localDay} from './today-palette.js';

export function createTodayAppearance(character,skins,skinGradient){
  const meshes=Object.fromEntries(Object.entries({skin:'Skin',hair:'Hair',outer:'Shirt',trousers:'Trousers'}).map(([key,name])=>[key,character.getObjectByName(name)]));
  const original=Object.fromEntries(Object.entries(meshes).map(([key,mesh])=>[key,mesh.material.color.clone()]));
  const originalGradient=skinGradient?.enabled??false;
  const shirt=meshes.outer,shirtRest=shirt.geometry.attributes.position.array.slice();
  const originalShirtColors=shirt.geometry.attributes.color?.clone(),originalVertexColors=shirt.material.vertexColors;
  const details=['White_details','Face_ink','Clothing_internal_lines'].map(name=>character.getObjectByName(name)).filter(Boolean).map(mesh=>({mesh,visible:mesh.visible}));
  const arms=['Arm_left','Arm_right'].map(name=>{
    const mesh=character.getObjectByName(name);
    return {mesh,colors:mesh.geometry.attributes.color.array.slice(),x:mesh.userData.restX||Array.from(mesh.geometry.attributes.position.array).filter((_,i)=>i%3===0)};
  });
  let current=null;
  function apply(value){
    const appearance=normalizeAppearance(value);
    if(!appearance)throw new Error('配色数据无效，请重新取色。');
    skinGradient?.setEnabled(false);skins.setSurfaceGradient(false);
    for(const [key,mesh] of Object.entries(meshes))mesh.material.color.set(appearance.colors[key]);
    for(const {mesh} of details)mesh.visible=false;
    const outer=new THREE.Color(appearance.colors.outer),inner=new THREE.Color(appearance.colors.inner);
    const bodyColors=new Float32Array(shirtRest.length);
    for(let i=0;i<shirtRest.length/3;i++){
      const x=shirtRest[i*3],z=shirtRest[i*3+2];
      // Follow the same cylindrical columns along the torso, so the opening
      // stays clean while the original physics deforms the character.
      const color=z>0&&Math.abs(x)/Math.hypot(x,z)<.38?inner:outer;
      bodyColors.set([color.r,color.g,color.b],i*3);
    }
    shirt.geometry.setAttribute('color',new THREE.BufferAttribute(bodyColors,3));
    shirt.material.color.set(0xffffff);shirt.material.vertexColors=true;shirt.material.needsUpdate=true;
    for(const {mesh,x} of arms){
      const colors=mesh.geometry.attributes.color;
      for(let i=0;i<colors.count;i++){
        const blend=THREE.MathUtils.smoothstep((Math.abs(x[i])-.5)/1.04,.415,.445);
        const color=outer.clone().lerp(meshes.skin.material.color,blend);
        colors.setXYZ(i,color.r,color.g,color.b);
      }
      colors.needsUpdate=true;
    }
    skins.setPalette({skinColor:appearance.colors.skin,noseColor:appearance.colors.skin});
    current=appearance;character.userData.todayAppearance=appearance;
    return appearance;
  }
  function reset(){
    skinGradient?.setEnabled(false);
    for(const [key,mesh] of Object.entries(meshes))mesh.material.color.copy(original[key]);
    if(originalShirtColors)shirt.geometry.setAttribute('color',originalShirtColors.clone());else shirt.geometry.deleteAttribute('color');
    shirt.material.vertexColors=originalVertexColors;shirt.material.needsUpdate=true;
    for(const {mesh,visible} of details)mesh.visible=visible;
    for(const {mesh,colors} of arms){mesh.geometry.attributes.color.array.set(colors);mesh.geometry.attributes.color.needsUpdate=true;}
    skins.setPalette({skinColor:'#'+original.skin.getHexString(),noseColor:'#fa97a8'});
    skinGradient?.setEnabled(originalGradient);skins.setSurfaceGradient(originalGradient);
    current=null;delete character.userData.todayAppearance;
  }
  return {apply,reset,get current(){return current;}};
}

export function mountStoredAppearance(controller,{storage=localStorage,onChange=()=>{}}={}){
  try{const saved=normalizeAppearance(JSON.parse(storage.getItem(APPEARANCE_KEY)));if(saved?.day===localDay())controller.apply(saved);}catch{}
  function set(value){
    const previous=controller.current;
    const next=value===null?null:normalizeAppearance(value);
    if(value!==null&&!next)throw new Error('配色数据无效，请重新取色。');
    if(next)next.day=localDay();
    try{
      if(next){controller.apply(next);storage.setItem(APPEARANCE_KEY,JSON.stringify(next));}
      else{controller.reset();storage.removeItem(APPEARANCE_KEY);}
    }catch(error){if(previous)controller.apply(previous);else controller.reset();throw new Error('配色未能保存，请重试。',{cause:error});}
    onChange(next);return next;
  }
  // Today's palette survives restarts, then naturally expires the following day.
  const expiry=setInterval(()=>{if(controller.current&&controller.current.day!==localDay()){controller.reset();onChange(null);}},60000);
  globalThis.window?.addEventListener('pagehide',()=>clearInterval(expiry),{once:true});
  return {set,dispose:()=>clearInterval(expiry)};
}
