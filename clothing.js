import * as THREE from 'three';
import {FACE_STROKE} from './skins.js';
import {GARMENT_DEPTH} from './model.mjs';

export const PASTEL_SKIN='#f5c2c5'; // User-selected 柔玫粉, shared by body and face print.
export const PASTEL_TEAL='#629fa1';
export const OUTFITS=[
  {id:'plain',name:'原版衣服',note:'干净色块 · 保留原版服装',swatches:['#c4d8e5','#344659','#ffc9ae']},
  {id:'outlined',name:'内部描边',note:'领口、衣领、领带与袖口 · 统一线宽',swatches:['#c4d8e5','#344659','#ffc9ae']},
  {id:'pastel',name:'粉蓝青绿',note:'柔玫粉肤色 · 浅蓝衬衫 · 青绿裤身 · 浅蓝底座饰带',swatches:[PASTEL_SKIN,'#c3d8f4','#629fa1']},
  {id:'comic',name:'漫画动感',note:'柔玫粉配色 · 跟随摇晃的漫画斜线 · 手绘逐帧微抖动',swatches:[PASTEL_SKIN,'#c3d8f4','#629fa1']},
  {id:'gradient',name:'青绿渐变',note:'头部越低，皮肤青绿渐变越深、范围越大；抬至最高时恢复柔玫粉',swatches:[PASTEL_SKIN,PASTEL_TEAL,'#c3d8f4']}
];
// Match the facial print's mouth width in rest-space world units.
export const CLOTHING_LINE_WIDTH=FACE_STROKE*2.65/512*1.18;
const toY=y=>.64+(y-.64)*4.9/7.6;

export function createClothing(character,{onPaletteChange=()=>{}}={}){
  const positions=[],indices=[],width=CLOTHING_LINE_WIDTH;
  const vertex=p=>{positions.push(...p);return positions.length/3-1;};
  const quad=(a,b,c,d)=>indices.push(a,b,c,b,d,c);
  const bodyPoint=(x,y,depth)=>{
    const radius=.66-.025*(y-.64)/4.9;
    return [x,y,Math.sqrt(Math.max(.01,radius*radius-x*x))+depth];
  };
  function polygon(points,depth){
    const loop=points.map(([x,y])=>new THREE.Vector2(x,toY(y)));
    const sides=[];
    for(let i=0;i<loop.length;i++){
      const p=loop[i],prev=loop[(i+loop.length-1)%loop.length],next=loop[(i+1)%loop.length];
      const before=p.clone().sub(prev).normalize(),after=next.clone().sub(p).normalize();
      const n1=new THREE.Vector2(-before.y,before.x),n2=new THREE.Vector2(-after.y,after.x);
      const miter=n1.clone().add(n2).normalize();
      const offset=miter.multiplyScalar(Math.min(width*1.8,width/2/Math.max(.25,miter.dot(n1))));
      sides.push([p.clone().add(offset),p.clone().sub(offset)]);
    }
    // Subdivision lets each line bend with the same body solver as the fabric.
    for(let i=0;i<loop.length;i++){
      const [a,b]=sides[i],[c,d]=sides[(i+1)%loop.length];
      let previous;
      const steps=Math.max(4,Math.ceil(loop[i].distanceTo(loop[(i+1)%loop.length])/.035));
      for(let j=0;j<=steps;j++){
        const left=a.clone().lerp(c,j/steps),right=b.clone().lerp(d,j/steps);
        const pair=[vertex(bodyPoint(left.x,left.y,depth)),vertex(bodyPoint(right.x,right.y,depth))];
        if(previous)quad(previous[0],previous[1],pair[0],pair[1]);previous=pair;
      }
    }
  }
  // Neckline: a complete cylindrical seam rather than an inverted silhouette.
  for(let i=0;i<=96;i++){
    const angle=i/96*Math.PI*2;
    for(const side of [-1,1]){
      const y=toY(5.65)+side*width/2,r=.66-.025*(y-.64)/4.9+.014;
      vertex([Math.cos(angle)*r,y,Math.sin(angle)*r]);
    }
    if(i)quad((i-1)*2,(i-1)*2+1,i*2,i*2+1);
  }
  polygon([[-.48,5.65],[0,5.62],[-.22,5.12]],GARMENT_DEPTH.collarOutline);
  polygon([[0,5.62],[.48,5.65],[.22,5.12]],GARMENT_DEPTH.collarOutline);
  polygon([[-.10,5.48],[.10,5.48],[.07,5.14],[-.07,5.14]],GARMENT_DEPTH.tieOutline);
  polygon([[-.065,5.14],[.065,5.14],[.14,3.92],[0,3.72],[-.14,3.92]],GARMENT_DEPTH.tieOutline);
  // Both sleeve openings use exactly the same width, wrapped around the arms.
  for(const sign of [-1,1]){
    const start=positions.length/3,indexStart=indices.length;
    for(let i=0;i<=64;i++){
      const angle=i/64*Math.PI*2;
      for(const side of [-1,1]){
        const x=sign*(.5+.43*1.04)+side*width/2;
        const u=(Math.abs(x)-.5)/1.04,r=.235-.065*THREE.MathUtils.smoothstep(u,0,1)+.012;
        vertex([x,toY(5.35)+Math.cos(angle)*r,Math.sin(angle)*r]);
      }
      if(i)quad(start+(i-1)*2,start+(i-1)*2+1,start+i*2,start+i*2+1);
    }
    const cuffGeometry=new THREE.BufferGeometry();
    cuffGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions.splice(start*3),3));
    cuffGeometry.setIndex(indices.splice(indexStart).map(i=>i-start));cuffGeometry.computeVertexNormals();
    const cuff=new THREE.Mesh(cuffGeometry,new THREE.MeshBasicMaterial({color:0x343532,side:THREE.DoubleSide}));
    cuff.name='Clothing_cuff_'+sign;cuff.userData.armSign=sign;cuff.userData.deformWithBody=true;cuff.visible=false;cuff.frustumCulled=false;character.add(cuff);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new THREE.MeshBasicMaterial({color:0x343532,side:THREE.DoubleSide});
  material.userData.outlineParameters={visible:false};
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Clothing_internal_lines';
  mesh.userData.deformWithBody=true;mesh.frustumCulled=false;mesh.visible=false;character.add(mesh);
  const waistY=toY(2.25),waistRadius=.66-.025*(waistY-.64)/4.9+.012;
  const waistGeometry=new THREE.CylinderGeometry(waistRadius,waistRadius,width,96,2,true);
  waistGeometry.translate(0,waistY,0);
  const waist=new THREE.Mesh(waistGeometry,material);waist.name='Clothing_waist_line';
  waist.userData.deformWithBody=true;waist.frustumCulled=false;waist.visible=false;character.add(waist);
  const bandMaterial=new THREE.MeshBasicMaterial({color:0xc3d8f4,side:THREE.DoubleSide});
  bandMaterial.userData.outlineParameters={visible:false};
  // Follow the fixed blower's tapered wall; this band is below the fabric.
  const band=new THREE.Mesh(new THREE.CylinderGeometry(.74-.08*(.135/.64)+.005,.74-.08*(.035/.64)+.005,.10,64,1,true),bandMaterial);
  band.position.y=.085;band.name='Clothing_base_band';band.visible=false;character.add(band);
  const shirt=character.getObjectByName('Shirt'),trousers=character.getObjectByName('Trousers'),skin=character.getObjectByName('Skin');
  const original={shirt:shirt.material.color.clone(),trousers:trousers.material.color.clone(),skin:skin.material.color.clone()};
  const vents=character.children.filter(child=>child.name.startsWith('Blower_vent_'));
  for(const sign of [-1,1]){const arm=character.getObjectByName(sign<0?'Arm_left':'Arm_right');arm.userData.restX=Array.from({length:arm.geometry.attributes.position.count},(_,i)=>arm.geometry.attributes.position.getX(i));}
  let active='plain';
  return {
    get active(){return active;},
    select(id){
      if(!OUTFITS.some(outfit=>outfit.id===id))return false;
      const pastel=['pastel','comic','gradient'].includes(id);active=id;mesh.visible=id!=='plain';waist.visible=pastel;band.visible=pastel;
      shirt.material.color.copy(original.shirt);trousers.material.color.copy(original.trousers);skin.material.color.copy(original.skin);
      if(pastel){shirt.material.color.set('#c3d8f4');trousers.material.color.set(PASTEL_TEAL);skin.material.color.set(PASTEL_SKIN);}
      for(const sign of [-1,1]){
        character.getObjectByName('Clothing_cuff_'+sign).visible=id!=='plain';
        const arm=character.getObjectByName(sign<0?'Arm_left':'Arm_right'),a=arm.geometry.attributes.color,pos=arm.geometry.attributes.position;
        const shirtColor=shirt.material.color,skinColor=skin.material.color;
        for(let i=0;i<a.count;i++){
          const u=(Math.abs(arm.userData.restX?.[i]??pos.getX(i))-.5)/1.04;
          const color=shirtColor.clone().lerp(skinColor,THREE.MathUtils.smoothstep(u,.415,.445));a.setXYZ(i,color.r,color.g,color.b);
        }a.needsUpdate=true;
      }
      for(const vent of vents)vent.visible=!pastel;
      onPaletteChange({skinColor:pastel?PASTEL_SKIN:'#ffc9ae',noseColor:pastel?PASTEL_SKIN:'#fa97a8'});
      character.userData.outfit=id;return true;
    }
  };
}
