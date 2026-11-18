import * as THREE from 'three';

// Flat colors are independent of scene lights, shared with the unlit GLB export.
export function applyToon(root) {
  root.traverse(o=>{
    if(!o.isMesh)return;
    const original=o.material;
    const mat=new THREE.MeshBasicMaterial({color:original.color,side:original.side,vertexColors:original.vertexColors});
    o.material=mat;
    original.dispose();
  });
}
