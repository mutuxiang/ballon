import * as THREE from 'three';
import {PASTEL_SKIN,PASTEL_TEAL} from './clothing.js';

// The solver's fully upright head node is .64 + 4.9. A small dead zone avoids
// unwanted tint from the small natural height loss around its highest pose.
export const MAX_HEAD_HEIGHT=5.54;
export const GRADIENT_CLEAR_HEIGHT=5.42;
const LOW_HEAD_HEIGHT=.36;

export function gradientAtHeight(headHeight){
  const height=Number.isFinite(headHeight)?headHeight:MAX_HEAD_HEIGHT;
  const drop=THREE.MathUtils.clamp((GRADIENT_CLEAR_HEIGHT-height)/(GRADIENT_CLEAR_HEIGHT-LOW_HEAD_HEIGHT),0,1);
  return {strength:Math.pow(drop,.8),range:drop===0?0:.12+drop*4.5};
}

export function createSkinGradient(character,skins){
  const skin=character.getObjectByName('Skin'),geometry=skin.geometry;
  // Only this mesh contains face/neck skin and exposed forearms/hands. Clothing,
  // hair, eyes, collar, tie and the blower never receive a color attribute.
  const rest=geometry.attributes.position.array;
  const restY=Float32Array.from({length:rest.length/3},(_,i)=>rest[i*3+1]);
  const attribute=new THREE.Float32BufferAttribute(new Float32Array(rest.length),3).setUsage(THREE.DynamicDrawUsage);
  const pink=new THREE.Color(PASTEL_SKIN),teal=new THREE.Color(PASTEL_TEAL);
  let enabled=false,lastHeight=null,strength=0,range=0;
  function paint(headHeight){
    ({strength,range}=gradientAtHeight(headHeight));
    for(let i=0;i<restY.length;i++){
      // Use anatomical rest height so the vertical gradient sticks to the skin
      // as the head bends, rather than sliding through it with the camera.
      const depth=Math.max(0,MAX_HEAD_HEIGHT-restY[i]);
      const blend=range>0?strength*(1-THREE.MathUtils.smoothstep(depth,0,range)):0;
      attribute.setXYZ(i,
        THREE.MathUtils.lerp(pink.r,teal.r,blend),
        THREE.MathUtils.lerp(pink.g,teal.g,blend),
        THREE.MathUtils.lerp(pink.b,teal.b,blend));
    }
    attribute.needsUpdate=true;lastHeight=headHeight;
    character.userData.skinGradient={headHeight,strength,range};
  }
  return {
    get enabled(){return enabled;},get strength(){return strength;},get range(){return range;},
    setEnabled(value){
      const next=Boolean(value),changed=next!==enabled;enabled=next;
      if(enabled){
        geometry.setAttribute('color',attribute);skin.material.color.set(0xffffff);
        if(changed)paint(MAX_HEAD_HEIGHT);
      }else{
        // Remove, not just disable, colors so GLB exports of other outfits stay
        // their original flat colors too. Clothing already restored base color.
        geometry.deleteAttribute('color');strength=0;range=0;delete character.userData.skinGradient;
      }
      skin.material.vertexColors=enabled;if(changed)skin.material.needsUpdate=true;
      skins.setSurfaceGradient(enabled);lastHeight=null;
    },
    update(simulation){
      if(!enabled)return;
      const headHeight=simulation.nodes[24].p.y;
      if(lastHeight===null||Math.abs(headHeight-lastHeight)>.00001)paint(headHeight);
    }
  };
}
