import {createCameraSession,cameraErrorMessage} from './today-camera.js';
import {localDay,samplePhotoColors} from './today-palette.js';
import './today-avatar.css';
import mirrorHelper from './assets/today-helper-mirror.png';
import cameraHelper from './assets/today-helper-camera.png';

const cameraIcon='<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M16 12l3-5h10l3 5h7a4 4 0 014 4v22a4 4 0 01-4 4H9a4 4 0 01-4-4V16a4 4 0 014-4z"/><circle cx="24" cy="26" r="9"/></svg>';
export function mountTodayAvatar(parent,{compact=false,onOpen=()=>{},onApply=()=>{}}={}){
  const entry=document.createElement('button');entry.type='button';entry.className='today-entry'+(compact?' today-entry-compact':'');
  entry.innerHTML=`${cameraIcon}<span>自定义今天的小人</span>`;parent.append(entry);
  const dialog=document.createElement('dialog');dialog.className='today-dialog';dialog.setAttribute('aria-labelledby','today-title');
  dialog.innerHTML=`
    <button class="today-close" aria-label="关闭自定义小人">×</button>
    <h2 id="today-title">今天的你</h2><p class="today-subtitle" hidden></p>
    <section class="today-step-photo" aria-label="第一步：今天的你">
      <div class="today-shooting">
        <div class="today-helper"><img src="${mirrorHelper}" alt="拿镜子的小人" draggable="false"></div>
        <div class="today-photo"><div class="today-empty"><div class="today-camera-mark">${cameraIcon}</div><span>正面入镜，尽量拍到上衣</span></div>
        <video muted playsinline autoplay hidden aria-label="摄像头实时画面"></video><img class="today-photo-image" alt="确认今天的照片" hidden>
        <div class="today-guide" hidden aria-hidden="true"><i></i><span>脸放在框内</span></div><span class="today-live" hidden>相机已开启</span>
        </div>
        <div class="today-helper"><img src="${cameraHelper}" alt="拿相机的小人" draggable="false"></div>
      </div>
      <div class="today-secondary"><button class="today-retake" hidden>重新拍照</button><button class="today-upload">选择本地照片</button></div>
    </section>
    <section class="today-step-avatar" aria-label="第二步：今天的小人" hidden>
      <div class="today-preview"><div class="today-generating"><span class="today-spinner"></span><span>正在提取今天的配色…</span></div></div>
      <div class="today-colors" hidden>${[['skin','肤色'],['hair','发色'],['outer','外套'],['inner','内搭'],['trousers','裤装']].map(([key,label])=>`<label><input type="color" data-color="${key}" aria-label="调整${label}"><span>${label}</span></label>`).join('')}</div>
      <p class="today-color-note">取色有偏差？点击色块，微调一下。</p>
    </section>
    <p class="today-feedback" role="status" aria-live="polite"></p><button class="today-primary">打开摄像头</button><button class="today-back" hidden>返回照片</button>
    <input class="today-file" type="file" accept="image/jpeg,image/png,image/webp" hidden>
  `;
  document.body.append(dialog);
  const $=selector=>dialog.querySelector(selector),video=$('video'),primary=$('.today-primary'),feedback=$('.today-feedback');
  let state='empty',revision=0,photoCanvas=null,appearance=null,preview=null,opener;
  const camera=createCameraSession(navigator.mediaDevices,()=>{video.srcObject=null;if(dialog.open){render('empty');feedback.textContent='摄像头已断开，请重新打开或选择照片。';}});
  function stopCamera(){camera.stop();video.srcObject=null;}
  function cancelWork(){revision++;stopCamera();}
  function clearPreview(){preview?.dispose();preview=null;appearance=null;}
  function render(next){
    state=next;dialog.dataset.state=next;
    const second=['generating','ready','applying'].includes(next),busy=['starting','loading','generating','applying'].includes(next);
    $('.today-step-photo').hidden=second;$('.today-step-avatar').hidden=!second;
    $('#today-title').textContent=second?'今天的小人':'今天的你';
    $('.today-subtitle').hidden=!second;$('.today-subtitle').textContent=second?'把你的颜色，穿在小人身上。':'';
    video.hidden=next!=='live';$('.today-photo-image').hidden=!photoCanvas||next==='live';
    $('.today-empty').hidden=Boolean(photoCanvas)||next==='live';$('.today-guide').hidden=!['live','photo'].includes(next);
    $('.today-live').hidden=next!=='live';$('.today-retake').hidden=!photoCanvas;
    $('.today-generating').hidden=next!=='generating';$('.today-colors').hidden=!['ready','applying'].includes(next);
    $('.today-color-note').hidden=next==='generating';$('.today-back').hidden=!second;
    $('.today-back').disabled=next==='applying';$('.today-close').disabled=next==='applying';
    dialog.querySelectorAll('[data-color]').forEach(input=>input.disabled=next==='applying');primary.disabled=busy;
    primary.textContent={empty:'打开摄像头',starting:'等待相机授权…',live:'拍下今天',loading:'正在读取照片…',photo:'下一步，看看小人',generating:'正在取色…',ready:'应用到桌宠',applying:'正在应用…'}[next];
  }
  function setPhoto(source,{mirror=false}={}){
    const width=source.videoWidth||source.naturalWidth||source.width,height=source.videoHeight||source.naturalHeight||source.height;
    if(!width||!height)throw new Error('画面还在准备，请稍后再拍。');
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d'),size=Math.min(width,height);
    if(mirror){ctx.translate(512,0);ctx.scale(-1,1);}
    ctx.drawImage(source,(width-size)/2,(height-size)/2,size,size,0,0,512,512);
    photoCanvas=canvas;$('.today-photo-image').src=canvas.toDataURL('image/jpeg',.9);
    cancelWork();clearPreview();render('photo');feedback.textContent='确认照片，下一步看看你的配色小人。';
  }
  async function startCamera(){
    cancelWork();clearPreview();photoCanvas=null;$('.today-photo-image').removeAttribute('src');
    const current=revision;render('starting');feedback.textContent='请允许使用摄像头。';
    try{
      const stream=await camera.start();if(!stream||current!==revision||!dialog.open)return;
      video.srcObject=stream;await video.play();if(current!==revision||!dialog.open)return;
      render('live');feedback.textContent='看向镜头，准备好了就拍。';
    }catch(error){if(current!==revision||!dialog.open)return;stopCamera();render('empty');feedback.textContent=cameraErrorMessage(error);}
  }
  async function chooseFile(file){
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){feedback.textContent='请选择 JPG、PNG 或 WebP 照片。';return;}
    if(file.size>10*1024*1024){feedback.textContent='照片请小于 10 MB。';return;}
    cancelWork();const current=revision,url=URL.createObjectURL(file);render('loading');feedback.textContent='';
    try{const image=new Image();image.src=url;await image.decode();if(current!==revision||!dialog.open)return;setPhoto(image);}
    catch{if(current===revision&&dialog.open){render(photoCanvas?'photo':'empty');feedback.textContent='照片无法读取，请换一张试试。';}}
    finally{URL.revokeObjectURL(url);}
  }
  async function generate(){
    const current=revision;render('generating');feedback.textContent='';
    try{
      const {createTodayPreview}=await import('./today-preview.js');if(current!==revision||!dialog.open)return;
      const pixels=photoCanvas.getContext('2d').getImageData(0,0,512,512);appearance={version:2,day:localDay(),colors:samplePhotoColors(pixels)};
      preview=createTodayPreview($('.today-preview'),appearance);
      for(const input of dialog.querySelectorAll('[data-color]'))input.value=appearance.colors[input.dataset.color];
      render('ready');feedback.textContent='';primary.focus();
    }catch{clearPreview();if(current===revision&&dialog.open){render('photo');feedback.textContent='小人预览未能加载，请重试。';}}
  }
  primary.onclick=async()=>{
    if(state==='empty')return startCamera();
    if(state==='live'){try{setPhoto(video,{mirror:true});}catch(error){feedback.textContent=error.message;}return;}
    if(state==='photo')return generate();if(state!=='ready')return;
    render('applying');feedback.textContent='正在把配色同步给桌宠…';
    try{await onApply({...appearance,day:localDay()});entry.querySelector('span').textContent='今天的配色 · 已应用';dialog.close();}
    catch(error){render('ready');feedback.textContent=error.message||'应用失败，请重试。';}
  };
  for(const input of dialog.querySelectorAll('[data-color]'))input.oninput=()=>{if(state!=='ready')return;appearance.colors[input.dataset.color]=input.value;preview.set(appearance);};
  $('.today-back').onclick=()=>{cancelWork();clearPreview();render('photo');feedback.textContent='可以继续使用这张照片，也可以重拍。';primary.focus();};
  $('.today-retake').onclick=startCamera;$('.today-upload').onclick=()=>$('.today-file').click();
  $('.today-file').onchange=event=>{chooseFile(event.target.files[0]);event.target.value='';};
  $('.today-photo').ondragover=event=>event.preventDefault();$('.today-photo').ondrop=event=>{event.preventDefault();chooseFile(event.dataTransfer.files[0]);};
  $('.today-close').onclick=()=>dialog.close();dialog.addEventListener('cancel',event=>{if(state==='applying')event.preventDefault();});
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('close',()=>{cancelWork();clearPreview();photoCanvas=null;$('.today-photo-image').removeAttribute('src');render('empty');opener?.focus();});
  function open(){if(dialog.open)return;opener=document.activeElement;onOpen();render('empty');feedback.textContent='';dialog.showModal();primary.focus();}
  entry.onclick=open;
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&['live','starting'].includes(state)){cancelWork();render('empty');feedback.textContent='相机已暂停，回来后可重新打开。';}});
  window.addEventListener('pagehide',()=>{cancelWork();clearPreview();photoCanvas=null;});
  return {open,entry,get isOpen(){return dialog.open;}};
}
