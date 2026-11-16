import {writeFile,mkdir} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createDancer} from './model.mjs';
globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result='data:'+blob.type+';base64,'+Buffer.from(v).toString('base64');this.onloadend?.();});}
};
await mkdir('public',{recursive:true});
for(const state of ['high','low','none']){
  const {group,clip}=createDancer({state});
  const output=await new GLTFExporter().parseAsync(group,{binary:true,animations:state==='none'?[]:[clip]});
  const filename=state==='high'?'air-dancer.glb':'air-dancer-'+state+'.glb';
  await writeFile('public/'+filename,Buffer.from(output));
  console.log('Exported',state,output.byteLength,'bytes');
}
