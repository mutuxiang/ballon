import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createDancer} from './model.mjs';
const {group}=createDancer({rest:true});
const shoulder=.64+(5.35-.64)*4.9/7.6;
let checked=0;
for(const name of ['Arm_left','Arm_right']){
  const mesh=group.getObjectByName(name),g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal;
  assert.ok(mesh.material.vertexColors,'Sleeve and skin must use vertex colors on a single material');
  assert.ok(!Array.isArray(mesh.material));
  const edges=new Map(),adj=Array.from({length:p.count},()=>[]);
  for(let i=0;i<g.index.count;i+=3){
    const tri=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];
    for(let j=0;j<3;j++){
      const a=tri[j],b=tri[(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');
      edges.set(key,(edges.get(key)||0)+1);adj[a].push(b);adj[b].push(a);
    }
  }
  let boundary=0;
  for(const [edge,count] of edges){
    assert.ok(count<=2,'Nonmanifold arm edge');
    if(count===1){boundary++;for(const i of edge.split(',').map(Number))assert.ok(Math.abs(Math.abs(p.getX(i))-.5)<1e-5,'Unexpected cuff or palm boundary');}
  }
  assert.equal(boundary,32,'Only the shoulder root can be open');
  const visited=new Set([0]),todo=[0];while(todo.length){for(const n of adj[todo.pop()])if(!visited.has(n)){visited.add(n);todo.push(n);}}
  assert.equal(visited.size,p.count,'Arm and palm must be one connected surface');
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
