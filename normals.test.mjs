import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createDancer} from './model.mjs';
const {group}=createDancer({rest:true});
const shoulder=.64+(5.35-.64)*4.9/7.6;
let checked=0;
for(const name of ['Shirt','Skin']){
  const g=group.getObjectByName(name).geometry,p=g.attributes.position,n=g.attributes.normal;
  for(let i=0;i<p.count;i++){
    const v=new Vector3().fromBufferAttribute(p,i);
    if(Math.abs(v.x)<.72||Math.abs(v.y-shoulder)>.26)continue;
    const center=new Vector3(Math.sign(v.x)*Math.min(Math.abs(v.x),1.54),shoulder,0);
    const radial=v.clone().sub(center).normalize();
    if(radial.lengthSq()<.1)continue;
    assert.ok(radial.dot(new Vector3().fromBufferAttribute(n,i))>.7,`${name} arm/hand normal ${i} faces inward`);
    checked++;
  }
}
assert.ok(checked>1000);
console.log(`Verified ${checked} outward sleeve, forearm and mitten normals on both sides.`);
