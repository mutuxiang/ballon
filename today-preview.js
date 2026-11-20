import * as THREE from 'three';
import {createDancer} from './model.mjs';
import {createSkins} from './skins.js';
import {createClothing} from './clothing.js';
import {SilhouetteEffect} from './silhouette.js';
import {createTodayAppearance} from './today-appearance.js';

export function createTodayPreview(host,appearance){
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label','你的配色小人实时预览');renderer.domElement.setAttribute('role','img');host.append(renderer.domElement);
  const scene=new THREE.Scene(),character=createDancer({rest:true,separateFace:true}).group;scene.add(character);
  const skins=createSkins(character);createClothing(character,{onPaletteChange:palette=>skins.setPalette(palette)}).select('plain');skins.select('chill');
  const controller=createTodayAppearance(character,skins);controller.apply(appearance);
  const camera=new THREE.OrthographicCamera(-3.6,3.6,6.2,-.5,.1,100);camera.position.z=20;
  const outline=new SilhouetteEffect(renderer,character);
  function render(){const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.left=-3.35*width/height;camera.right=-camera.left;camera.updateProjectionMatrix();outline.render(scene,camera);}
  const observer=new ResizeObserver(render);observer.observe(host);render();
  return {
    set(value){controller.apply(value);render();},
    dispose(){
      observer.disconnect();skins.dispose?.();
      const materials=new Set();character.traverse(object=>{object.geometry?.dispose();if(object.material)for(const material of [object.material].flat())materials.add(material);});
      materials.forEach(material=>{material.map?.dispose();material.dispose();});
      outline.color.dispose();outline.mask.dispose();outline.white.dispose();outline.material.dispose();outline.quadScene.children[0].geometry.dispose();
      renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    },
  };
}
