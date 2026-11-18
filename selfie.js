import './selfie.css';
import {captureFrame,withTimeout} from './camera-capture.js';
import {analyzePortrait} from './portrait-analysis.mjs';
import {renderPortrait} from './portrait-art.js';
import {createSelfieSkin} from './selfie-skin.js';

export function mountSelfie(options){
 const skin=createSelfieSkin(options);
 const section=document.createElement('section');section.className='selfie-picker';
 section.innerHTML='<div class="skin-heading"><h2>自拍漫画皮肤</h2><span>把今天的自己画上去</span></div><button type="button" id="open-selfie">自拍 / 导入上半身照片</button><button type="button" id="clear-selfie" hidden>恢复原有皮肤</button>';
 document.querySelector('#air-states').append(section);
 const dialog=document.createElement('dialog');dialog.className='selfie-dialog';
 dialog.innerHTML=`<button type="button" class="selfie-close" aria-label="关闭">×</button>
 <div class="selfie-eyebrow">YOUR LOOK, OUR LITTLE WORKER.</div><h2>把自己，画成营业小人。</h2>
 <p>照片提取特征 → 统一漫画笔触重绘 → 生成头部与服装贴图。</p>
 <div class="selfie-columns"><figure><figcaption>01 / 上半身照片</figcaption><div class="selfie-preview"><video autoplay muted playsinline hidden></video><canvas id="selfie-source" width="240" height="320"></canvas><div class="selfie-guide"><span>头发与脸部</span><hr><span>肩膀与衣服</span></div></div><small>拖动、缩放，使脸部位于上半格。</small></figure>
 <figure><figcaption>02 / 漫画皮肤预览</figcaption><div class="selfie-result"><canvas id="selfie-result" width="360" height="480" hidden></canvas><div id="selfie-empty">同一支笔，画今天的你。<br><small>统一线宽 · 简化五官 · 纯色色块</small></div></div><small>去除背景、阴影与照片纹理后重新绘制。</small></figure></div>
 <div class="selfie-actions"><button id="selfie-camera">开启相机</button><button id="selfie-shot" disabled>拍一张</button><label class="selfie-file">选择照片<input type="file" accept="image/*" id="selfie-file"></label><label class="selfie-zoom">取景缩放<input type="range" id="selfie-zoom" min="1" max="3" step=".05" value="1"></label></div>
 <fieldset class="selfie-features" disabled><legend>特征校对 <small>本地估计可能有偏差，可微调后实时重绘</small></legend>
 <label>发型<select id="selfie-hairstyle"><option value="parted">偏分短发</option><option value="fringe">齐刘海</option><option value="long">长发</option><option value="cropped">极短发</option></select></label>
 <label>表情<select id="selfie-expression"><option value="calm">放松平嘴</option><option value="smile">微笑</option><option value="grin">露齿笑</option><option value="pout">嘟嘴</option></select></label>
 <label>服装<select id="selfie-outfit"><option value="tee">圆领上衣</option><option value="jacket">外套 / 内搭</option><option value="collar">衬衫</option></select></label>
 <label>眼镜<select id="selfie-glasses"><option value="no">无眼镜</option><option value="yes">有眼镜</option></select></label>
 <label>发色<input id="selfie-hair" type="color"></label><label>肤色<input id="selfie-skin" type="color"></label><label>衣服<input id="selfie-shirt" type="color"></label><label>内搭<input id="selfie-inner" type="color"></label>
 </fieldset>
 <p role="status" id="selfie-status">照片仅在本机处理。请使用正面上半身照片，先对齐再生成。</p>
 <div class="selfie-footer"><button id="selfie-generate" disabled>生成漫画皮肤</button><button id="selfie-apply" disabled>穿到小人上 ↗</button></div>`;
 document.body.append(dialog);
 const $=s=>dialog.querySelector(s),canvas=$('#selfie-source'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 let stream,image,art,features,zoom=1,ox=0,oy=0,drag=null,disposed=false,cameraRequest=0;
 function status(t){$('#selfie-status').textContent=t;}
 function stop(){cameraRequest++;stream?.getTracks().forEach(t=>t.stop());stream=null;$('video').srcObject=null;$('video').hidden=true;$('#selfie-shot').disabled=true;$('#selfie-camera').disabled=false;$('#selfie-camera').textContent='开启相机';}
 function invalidate(){art=null;features=null;$('#selfie-apply').disabled=true;$('.selfie-features').disabled=true;$('#selfie-result').hidden=true;$('#selfie-empty').hidden=false;}
 function draw(){if(!image)return;const scale=Math.max(240/image.width,320/image.height)*zoom;ctx.clearRect(0,0,240,320);ctx.fillStyle='#edf0eb';ctx.fillRect(0,0,240,320);ctx.drawImage(image,(240-image.width*scale)/2+ox,(320-image.height*scale)/2+oy,image.width*scale,image.height*scale);invalidate();$('#selfie-generate').disabled=false;}
 function accept(bitmap){image?.close?.();image=bitmap;zoom=1;ox=oy=0;$('#selfie-zoom').value=1;draw();}
 section.querySelector('#open-selfie').onclick=()=>{disposed=false;dialog.showModal();};
 $('.selfie-close').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{disposed=true;stop();image?.close?.();image=null;invalidate();ctx.clearRect(0,0,240,320);$('#selfie-generate').disabled=true;});addEventListener('pagehide',stop);
 function updateCameraReady(){const v=$('video');if(stream&&!disposed){$('#selfie-shot').disabled=v.readyState<2||!v.videoWidth;}}
 $('video').addEventListener('loadeddata',updateCameraReady);
 $('video').addEventListener('canplay',updateCameraReady);
 $('#selfie-camera').onclick=async()=>{
  stop();const request=cameraRequest;
  $('#selfie-camera').disabled=true;$('#selfie-camera').textContent='正在开启…';
  status('正在等待相机权限与画面，请在浏览器中允许使用摄像头。');
  try{
   const pending=navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:720},height:{ideal:960}},audio:false});
   pending.then(s=>{if(disposed||request!==cameraRequest)s.getTracks().forEach(t=>t.stop());},()=>{});
   const s=await withTimeout(pending,15000,'开启相机超时，请检查权限后重试，或选择本地照片。');
   if(disposed||request!==cameraRequest){s.getTracks().forEach(t=>t.stop());return;}
   stream=s;const v=$('video');v.srcObject=s;v.hidden=false;
   await withTimeout(v.play(),8000,'相机画面未就绪，请重新开启相机。');
   if(disposed||request!==cameraRequest)return;
   updateCameraReady();$('#selfie-camera').disabled=false;$('#selfie-camera').textContent='重新开启相机';
   status('正对相机，画面就绪后点击「拍一张」。');
  }catch(error){if(disposed||request!==cameraRequest)return;stop();status(error.name==='NotAllowedError'?'相机权限被拒绝，请允许使用摄像头或选择照片。':error.message||'无法打开相机，请重试或选择照片。');}
 };
 $('#selfie-shot').onclick=()=>{
  const button=$('#selfie-shot');button.disabled=true;button.textContent='正在拍摄…';
  try{
   const frame=captureFrame($('video'));
   accept(frame);stop();
   status('拍摄成功！可拖动、缩放照片，下一步点击「生成漫画皮肤」。');
   $('#selfie-generate').scrollIntoView({block:'nearest',behavior:'smooth'});
  }catch(error){status(error.message||'拍摄失败，请重试或选择本地照片。');updateCameraReady();}
  finally{button.textContent='拍一张';}
 };
 $('#selfie-file').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{const b=await withTimeout(createImageBitmap(file),10000,'照片读取超时，请换一张 JPG 或 PNG 重试。');if(disposed){b.close();return;}stop();accept(b);status('照片已就绪。对齐取景框后，点击「生成漫画皮肤」。');}catch(error){status(error.message||'照片无法读取，请选择 JPG 或 PNG。');}};
 $('#selfie-zoom').oninput=e=>{zoom=+e.target.value;draw();};
 canvas.onpointerdown=e=>{if(!image)return;drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};
 canvas.onpointermove=e=>{if(!drag)return;const r=canvas.getBoundingClientRect();ox+=(e.clientX-drag.x)*240/r.width;oy+=(e.clientY-drag.y)*320/r.height;drag={x:e.clientX,y:e.clientY};draw();};
 canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
 function showArt(){art=renderPortrait(features);const preview=$('#selfie-result');preview.getContext('2d').drawImage(art.preview,0,0);preview.hidden=false;$('#selfie-empty').hidden=true;$('#selfie-apply').disabled=false;}
 const keys=['hairstyle','expression','outfit','hair','skin','shirt','inner'];
 function updateFields(){for(const key of keys)$('#selfie-'+key).value=features[key];$('#selfie-glasses').value=features.glasses?'yes':'no';$('.selfie-features').disabled=false;}
 for(const key of [...keys,'glasses'])$('#selfie-'+key).addEventListener('input',()=>{if(!features)return;features[key]=key==='glasses'?$('#selfie-glasses').value==='yes':$('#selfie-'+key).value;showArt();status('已按校对的特征重新绘制，可直接应用。');});
 $('#selfie-generate').onclick=()=>{
  try{features=analyzePortrait(ctx.getImageData(0,0,240,320));updateFields();showArt();status(features.confidence<.3?'已生成漫画草稿，脸部取样不确定，请检查肤色、发型与表情。':'漫画皮肤已重绘。请核对发型、配色与表情，确认后穿到小人上。');}
  catch(error){invalidate();status(error.message||'生成失败，请重新选择照片。');}
 };
 $('#selfie-apply').onclick=()=>{if(!art)return;try{skin.apply(art);section.querySelector('#clear-selfie').hidden=false;dialog.close();}catch{status('皮肤应用失败，请重新生成后再试。');}};
 function clear(){skin.clear();section.querySelector('#clear-selfie').hidden=true;}
 section.querySelector('#clear-selfie').onclick=clear;
 document.querySelectorAll('[data-skin],[data-outfit],[data-expression-mode]').forEach(b=>b.addEventListener('click',clear,{capture:true}));
 return {clear,get active(){return skin.active;}};
}
