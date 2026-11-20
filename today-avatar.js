import * as THREE from 'three';
import { createDancer } from './model.mjs';
import { createSkins } from './skins.js';
import { createClothing } from './clothing.js';
import { SilhouetteEffect } from './silhouette.js';
import { createCameraSession, cameraErrorMessage } from './today-camera.js';
import './today-avatar.css';

export const TODAY_DEMO = Object.freeze({ skin: 'smile', outfit: 'pastel' });
const cameraIcon = '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M16 12l3-5h10l3 5h7a4 4 0 014 4v22a4 4 0 01-4 4H9a4 4 0 01-4-4V16a4 4 0 014-4z"/><circle cx="24" cy="26" r="9"/><path d="M35 19h2"/></svg>';
const personIcon = '<svg viewBox="0 0 100 150" fill="none" aria-hidden="true"><path d="M35 48C13 48 8 71 13 94l14-3 3-21v66h40V70l3 21 14 3c5-23 0-46-22-46"/><rect x="30" y="8" width="40" height="49" rx="19"/><path d="M42 30h1m14 0h1M44 42q6 4 12 0M50 60v63"/></svg>';

// Reuse the actual app character. The photo is never sent to a generation API.
function demoPortrait() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  const scene = new THREE.Scene();
  const character = createDancer({ rest: true, separateFace: true }).group;
  scene.add(character);
  const skins = createSkins(character);
  const clothes = createClothing(character, { onPaletteChange: palette => skins.setPalette(palette) });
  clothes.select(TODAY_DEMO.outfit);
  skins.select(TODAY_DEMO.skin);
  const camera = new THREE.OrthographicCamera(-3.5, 3.5, 6.3, -.6, .1, 100);
  camera.position.set(0, 0, 20);
  renderer.setSize(520, 520);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const outline = new SilhouetteEffect(renderer, character);
  try {
    outline.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } finally {
    const textures = new Set();
    skins.dispose();
    character.traverse(object => {
      object.geometry?.dispose();
      for (const material of object.material ? [object.material].flat() : []) {
        if (material.map) textures.add(material.map);
        material.dispose();
      }
    });
    textures.forEach(texture => texture.dispose());
    outline.color.dispose(); outline.mask.dispose(); outline.white.dispose(); outline.material.dispose();
    outline.quadScene.children[0].geometry.dispose();
    renderer.dispose(); renderer.forceContextLoss();
  }
}

export function mountTodayAvatar(parent, { compact = false, onOpen = () => {}, onApply = () => {} } = {}) {
  const entry = document.createElement('button');
  entry.type = 'button';
  entry.className = 'today-entry' + (compact ? ' today-entry-compact' : '');
  entry.innerHTML = `${cameraIcon}<span>拍下今天的我</span><small>演示</small>`;
  parent.append(entry);
  const dialog = document.createElement('dialog');
  dialog.className = 'today-dialog';
  dialog.setAttribute('aria-labelledby', 'today-title');
  dialog.setAttribute('aria-describedby', 'today-disclaimer');
  dialog.innerHTML = `
    <div class="today-topline"><span>今日形象 <time></time></span><button class="today-close" aria-label="关闭今日形象">×</button></div>
    <h2 id="today-title">今天，也很有型。</h2>
    <p class="today-subtitle">拍一张照，让小人替你营业。</p>
    <div class="today-pair">
      <section><h3>今天的你</h3><div class="today-photo today-tile">
        <div class="today-camera-empty">${cameraIcon}<span>用电脑摄像头拍一张</span><small>正面入镜，轻松一点</small></div>
        <video muted playsinline autoplay hidden aria-label="摄像头实时预览"></video>
        <img class="today-photo-image" alt="今天的照片" hidden>
        <span class="today-live" hidden>相机已开启</span>
      </div><div class="today-photo-actions"><button class="today-retake" hidden>重新拍照</button><button class="today-upload">或上传照片</button></div></section>
      <section><h3>今天的小人 <span class="today-demo-label">演示</span></h3><div class="today-result today-tile">
        <div class="today-placeholder">${personIcon}<span>等一个今天的你</span></div>
        <div class="today-generating" hidden><span class="today-spinner"></span><span>小人准备营业中…</span></div>
        <img class="today-avatar-image" alt="演示小人：微笑表情、浅蓝衬衫与青绿裤身" hidden>
        <span class="today-stamp" hidden>今日营业</span>
      </div><p class="today-result-note">一点笑意，一点元气。</p></section>
    </div>
    <p class="today-feedback" role="status" aria-live="polite"></p>
    <button class="today-primary">打开摄像头</button>
    <p id="today-disclaimer">照片仅在本机预览 · 小人生成仅作演示</p>
    <input class="today-file" type="file" accept="image/jpeg,image/png,image/webp" hidden>
  `;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const video = $('video'), photo = $('.today-photo-image'), primary = $('.today-primary');
  const feedback = $('.today-feedback'), fileInput = $('.today-file');
  let state = 'empty', revision = 0, photoUrl = '', timer, portrait, opener;
  const camera = createCameraSession(navigator.mediaDevices, () => {
    if (!dialog.open) return;
    video.srcObject = null;
    render('empty');
    feedback.textContent = '摄像头已断开，请重新打开，或上传照片。';
  });
  function stopCamera() { camera.stop(); video.srcObject = null; }
  function releasePhoto() {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = ''; photo.removeAttribute('src');
  }
  function cancelWork() { revision++; clearTimeout(timer); stopCamera(); }
  function render(next) {
    state = next;
    dialog.dataset.state = next;
    video.hidden = next !== 'live';
    photo.hidden = !photoUrl;
    $('.today-camera-empty').hidden = Boolean(photoUrl) || next === 'live';
    $('.today-live').hidden = next !== 'live';
    $('.today-retake').hidden = !photoUrl;
    $('.today-placeholder').hidden = ['generating','ready'].includes(next);
    $('.today-generating').hidden = next !== 'generating';
    $('.today-avatar-image').hidden = next !== 'ready';
    $('.today-stamp').hidden = next !== 'ready';
    primary.disabled = ['starting','loading','generating'].includes(next);
    primary.textContent = { empty:'打开摄像头', starting:'等待相机授权…', live:'拍下今天', loading:'正在读取照片…', photo:'生成今日小人', generating:'正在生成…', ready:'用这个形象' }[next];
    $('.today-result-note').textContent = next === 'ready' ? '微笑营业 · 今日演示形象' : '一点笑意，一点元气。';
  }
  async function startCamera() {
    cancelWork(); releasePhoto(); feedback.textContent = '';
    const current = revision;
    render('starting');
    feedback.textContent = '请在浏览器提示中允许使用摄像头。';
    try {
      const stream = await camera.start();
      if (!stream || current !== revision || !dialog.open) return;
      video.srcObject = stream;
      await video.play();
      if (current !== revision || !dialog.open) return;
      render('live');
      feedback.textContent = '看向镜头，准备好了就拍。';
    } catch (error) {
      if (current !== revision || !dialog.open) return;
      stopCamera(); render('empty'); feedback.textContent = cameraErrorMessage(error);
    }
  }
  async function useBlob(blob) {
    cancelWork(); feedback.textContent = '';
    const current = revision;
    const nextUrl = URL.createObjectURL(blob);
    render('loading');
    const image = new Image(); image.src = nextUrl;
    try {
      await image.decode();
      if (current !== revision || !dialog.open) { URL.revokeObjectURL(nextUrl); return; }
      releasePhoto(); photoUrl = nextUrl; photo.src = nextUrl;
      render('photo'); feedback.textContent = '照片准备好了。给今天换个形象吧。';
    } catch {
      URL.revokeObjectURL(nextUrl);
      if (current !== revision || !dialog.open) return;
      render(photoUrl ? 'photo' : 'empty'); feedback.textContent = '这张图片无法读取，请换一张 JPG、PNG 或 WebP 照片。';
    }
  }
  async function takePhoto() {
    if (!video.videoWidth || !video.videoHeight) { feedback.textContent = '画面还在准备，请稍后再拍。'; return; }
    const capture = document.createElement('canvas'); capture.width = capture.height = 960;
    const context = capture.getContext('2d');
    const size = Math.min(video.videoWidth, video.videoHeight);
    context.translate(960, 0); context.scale(-1, 1);
    context.drawImage(video, (video.videoWidth-size)/2, (video.videoHeight-size)/2, size, size, 0, 0, 960, 960);
    const current = revision;
    stopCamera(); render('loading');
    const blob = await new Promise(resolve => capture.toBlob(resolve, 'image/jpeg', .9));
    if (current !== revision || !dialog.open) return;
    if (!blob) { render('empty'); feedback.textContent = '拍照失败，请重新拍一张。'; return; }
    await useBlob(blob);
  }
  function chooseFile(file) {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { feedback.textContent = '请选择 JPG、PNG 或 WebP 照片。'; return; }
    if (file.size > 10 * 1024 * 1024) { feedback.textContent = '照片请小于 10 MB，换一张再试试。'; return; }
    useBlob(file);
  }
  function open() {
    if (dialog.open) return;
    opener = document.activeElement;
    onOpen();
    const date = new Date();
    $('time').dateTime = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    $('time').textContent = `${String(date.getMonth()+1).padStart(2,'0')} / ${String(date.getDate()).padStart(2,'0')}`;
    feedback.textContent = ''; render('empty'); dialog.showModal(); primary.focus();
  }
  entry.onclick = open;
  $('.today-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    cancelWork(); releasePhoto(); render('empty'); opener?.focus();
  });
  dialog.addEventListener('keydown', event => event.stopPropagation());
  $('.today-retake').onclick = startCamera;
  $('.today-upload').onclick = () => fileInput.click();
  fileInput.onchange = () => { chooseFile(fileInput.files[0]); fileInput.value = ''; };
  const dropZone = $('.today-photo');
  dropZone.addEventListener('dragover', event => { event.preventDefault(); dropZone.classList.add('is-dragging'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-dragging'));
  dropZone.addEventListener('drop', event => { event.preventDefault(); dropZone.classList.remove('is-dragging'); chooseFile(event.dataTransfer.files[0]); });
  primary.onclick = async () => {
    if (state === 'empty') return startCamera();
    if (state === 'live') return takePhoto();
    if (state === 'ready') {
      onApply(TODAY_DEMO); entry.querySelector('span').textContent = '今日形象 · 已应用'; dialog.close(); return;
    }
    if (state !== 'photo') return;
    const current = revision;
    render('generating'); feedback.textContent = '正在准备演示形象…';
    timer = setTimeout(() => {
      if (current !== revision || !dialog.open) return;
      try {
        portrait ||= demoPortrait(); $('.today-avatar-image').src = portrait;
        render('ready'); feedback.textContent = '今日小人，准备营业！'; primary.focus();
      } catch {
        render('photo'); feedback.textContent = '小人预览未能加载，请重试。';
      }
    }, 1200);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ['live','starting'].includes(state)) {
      cancelWork(); render('empty'); feedback.textContent = '相机已暂停，回来后可重新打开。';
    }
  });
  window.addEventListener('pagehide', () => { cancelWork(); releasePhoto(); });
  return { open, entry, get isOpen() { return dialog.open; } };
}
