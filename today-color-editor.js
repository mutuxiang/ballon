import {recognizedColorVariants} from './today-palette.js';
const PARTS=[['skin','肤色'],['hair','发色'],['outer','外套'],['inner','内搭'],['trousers','裤装']];
export function mountColorEditor(host,onChange){
  let colors={},original={},active='outer',disabled=false;
  host.classList.add('today-color-editor');
  host.innerHTML=`<div class="today-parts" role="group" aria-label="选择改色部位">${PARTS.map(([key,label])=>`<button type="button" data-part="${key}" aria-expanded="false" aria-controls="today-color-popover"><i aria-hidden="true"></i><span>${label}</span></button>`).join('')}</div>
    <section class="today-color-popover" id="today-color-popover" aria-label="选择颜色" hidden>
      <div class="today-mixer-heading"><strong class="today-active-part">外套</strong><button type="button" class="today-color-reset">还原此色</button></div>
      <div class="today-presets" role="group" aria-label="识别颜色的深浅变化"></div>
    </section>`;
  const $=selector=>host.querySelector(selector),popover=$('.today-color-popover');
  function close(){popover.hidden=true;host.querySelectorAll('[data-part]').forEach(button=>button.setAttribute('aria-expanded','false'));}
  function sync(){
    host.querySelectorAll('[data-part]').forEach(button=>{button.querySelector('i').style.background=colors[button.dataset.part];});
    $('.today-color-reset').disabled=disabled||colors[active]===original[active];
    host.querySelectorAll('[data-preset]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.preset===colors[active])));
  }
  function update(hex){if(disabled)return;colors[active]=hex.toUpperCase();sync();onChange(active,colors[active]);close();}
  function open(key){
    const toggle=active===key&&!popover.hidden;close();if(toggle||disabled)return;
    active=key;$('.today-active-part').textContent=PARTS.find(([part])=>part===key)[1];
    const presets=recognizedColorVariants(original[key]);
    $('.today-presets').style.gridTemplateColumns=`repeat(${presets.length},minmax(0,1fr))`;
    $('.today-presets').replaceChildren(...presets.map(([name,hex])=>{
      const button=document.createElement('button');button.type='button';button.dataset.preset=hex;button.title=name;button.setAttribute('aria-label',name);button.style.background=hex;button.onclick=()=>update(hex);return button;
    }));
    popover.classList.toggle('is-above',innerHeight-host.getBoundingClientRect().bottom<170);
    popover.hidden=false;host.querySelector(`[data-part="${key}"]`).setAttribute('aria-expanded','true');sync();
  }
  host.querySelectorAll('[data-part]').forEach(button=>button.onclick=()=>open(button.dataset.part));
  $('.today-color-reset').onclick=()=>update(original[active]);
  document.addEventListener('pointerdown',event=>{if(!host.contains(event.target))close();});
  host.addEventListener('keydown',event=>{if(event.key==='Escape'&&!popover.hidden){event.preventDefault();event.stopPropagation();close();host.querySelector(`[data-part="${active}"]`).focus();}});
  return {
    set(value){colors=Object.fromEntries(PARTS.map(([key])=>[key,value[key].toUpperCase()]));original={...colors};close();sync();},
    setDisabled(value){disabled=value;host.querySelectorAll('button').forEach(button=>button.disabled=value);if(value)close();if(colors[active])sync();}
  };
}
