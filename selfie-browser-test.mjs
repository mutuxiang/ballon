import {chromium} from './.selfie-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5176/',{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.dancer?.scene);
await page.locator('#play').click();
await page.locator('#open-selfie').click();
// Simulated photographic input includes shading, small texture, and a busy background.
const photo=await page.evaluate(()=>{
 const c=document.createElement('canvas');c.width=240;c.height=320;const x=c.getContext('2d');
 x.fillStyle='#eae3da';x.fillRect(0,0,240,320);
 for(let i=0;i<18;i++){x.fillStyle=i%2?'#9b4848':'#a7b8bf';x.fillRect(i*17,0,5,320);}
 x.fillStyle='#292a27';x.beginPath();x.ellipse(120,109,76,108,0,0,Math.PI*2);x.fill();
 const skin=x.createLinearGradient(70,0,170,0);skin.addColorStop(0,'#b88568');skin.addColorStop(.55,'#e4ba98');skin.addColorStop(1,'#c59573');
 x.fillStyle=skin;x.beginPath();x.ellipse(120,98,49,66,0,0,Math.PI*2);x.fill();
 x.fillStyle='#252622';x.beginPath();x.moveTo(67,64);x.quadraticCurveTo(95,-16,171,54);x.lineTo(155,76);x.lineTo(127,36);x.lineTo(97,65);x.fill();
 x.fillStyle='#343532';for(const a of [102,139]){x.beginPath();x.ellipse(a,91,7,4,0,0,Math.PI*2);x.fill();}
 x.strokeStyle='#704939';x.lineWidth=3;x.beginPath();x.moveTo(105,132);x.quadraticCurveTo(122,145,139,129);x.stroke();
 x.fillStyle='#344149';x.beginPath();x.moveTo(33,210);x.lineTo(85,171);x.lineTo(155,171);x.lineTo(215,210);x.lineTo(240,320);x.lineTo(0,320);x.fill();
 x.fillStyle='#1e2429';x.fillRect(100,186,40,134);
 for(let i=0;i<1800;i++){const px=(i*37)%240,py=(i*17)%320;x.fillStyle=i%2?'#ffffff09':'#00000009';x.fillRect(px,py,2,2);}
 return c.toDataURL().split(',')[1];
});
await page.setInputFiles('#selfie-file',{name:'portrait.png',mimeType:'image/png',buffer:Buffer.from(photo,'base64')});
await page.locator('#selfie-generate').click();
await page.locator('#selfie-result').waitFor({state:'visible'});
await fs.mkdir('.selfie-test-output',{recursive:true});
await page.screenshot({path:'.selfie-test-output/portrait-preview.png'});
console.log('Generated fields',await page.locator('.selfie-features').evaluate(el=>[...el.querySelectorAll('input,select')].map(e=>[e.id,e.value])));
await page.locator('#selfie-hairstyle').selectOption('long');
await page.locator('#selfie-outfit').selectOption('jacket');
await page.locator('#selfie-expression').selectOption('smile');
const preview=await page.locator('#selfie-result').evaluate(c=>c.toDataURL().split(',')[1]);await fs.writeFile('.selfie-test-output/comic-skin.png',Buffer.from(preview,'base64'));
const before=await page.evaluate(()=>({meshes:window.dancer.simulation.meshes.length,children:window.dancer.scene.children.length}));
await page.locator('#selfie-apply').click();
const applied=await page.evaluate(()=>({skin:window.dancer.scene.userData.selfie,meshes:window.dancer.simulation.meshes.length,parts:window.dancer.scene.children.filter(o=>o.name.startsWith('Selfie_')).map(m=>({name:m.name,layer:m.layers.mask,texture:!!m.material.map}))}));
if(applied.parts.length!==3||applied.meshes!==before.meshes+3)throw Error('Skin attachment failed');
if(applied.parts.some(m=>m.layer!==3))throw Error('Missing silhouette layer');
await page.screenshot({path:'.selfie-test-output/applied.png'});
await page.screenshot({path:'.selfie-test-output/applied-character.png',clip:{x:440,y:145,width:420,height:680}});
// Exercise physical collapse and reinflation with the attached full-wrap textures.
await page.evaluate(()=>{const s=window.dancer.simulation;s.setState('none');for(let i=0;i<240;i++)s.update(1/60);for(const m of s.meshes.filter(o=>o.mesh.name.startsWith('Selfie_')))if(!Array.from(m.mesh.geometry.attributes.position.array).every(Number.isFinite))throw Error('Non-finite selfie deformation');s.setState('high');for(let i=0;i<240;i++)s.update(1/60);});
const downloadPromise=page.waitForEvent('download');
await page.locator('.download').click();
const download=await downloadPromise;
await download.saveAs('.selfie-test-output/custom-skin.glb');
const glb=await fs.readFile('.selfie-test-output/custom-skin.glb');
const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
if(!json.images||json.images.length<2)throw Error('Custom textures missing from GLB');
console.log('Exported GLB',glb.length,'bytes,',json.images.length,'images');
await page.locator('#clear-selfie').click();
const restored=await page.evaluate(()=>({meshes:window.dancer.simulation.meshes.length,children:window.dancer.scene.children.length,hasSkin:!!window.dancer.scene.userData.selfie}));
if(restored.meshes!==before.meshes||restored.children!==before.children||restored.hasSkin)throw Error('Skin cleanup failed');
if(errors.length)throw Error(errors.join('\n'));
console.log(JSON.stringify({before,applied,restored,pageErrors:errors}));
await browser.close();
