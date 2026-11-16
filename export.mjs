import {writeFile,mkdir} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createDancer} from './model.mjs';
globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result='data:'+blob.type+';base64,'+Buffer.from(v).toString('base64');this.onloadend?.();});}
};
const {group,clip}=createDancer();
const output=await new GLTFExporter().parseAsync(group,{binary:true,animations:[clip]});
await mkdir('public',{recursive:true});await writeFile('public/air-dancer.glb',Buffer.from(output));
console.log('Exported animated GLB:',output.byteLength,'bytes');
