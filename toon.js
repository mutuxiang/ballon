import * as THREE from 'three';

// Flat colors are independent of scene lights, shared with the unlit GLB export.
export function applyToon(root) {
  root.traverse(o=>{
    if(!o.isMesh)return;
    const original=o.material;
    const fabric=['Shirt','Skin','Hair','Trousers'].includes(o.name);
    const mat=new THREE.MeshBasicMaterial({color:original.color,side:original.side});
    mat.userData.outlineParameters={visible:fabric||o.name==='Blower',thickness:fabric?.0016:.0012,color:[.10,.13,.15]};
    o.material=mat;
    original.dispose();
  });
}
