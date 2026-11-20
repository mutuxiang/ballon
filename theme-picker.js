import {THEMES,THEME_ATLAS,THEME_STORAGE_KEY} from './theme-skins.js';
import './theme-skins.css';

export function mountThemePicker(parent,themes,{compact=false,onSelect=()=>{}}={}){
  const panel=document.createElement(compact?'details':'section');panel.className='theme-picker'+(compact?' theme-picker-compact':'');
  panel.setAttribute('aria-label','主题皮肤');
  const heading=document.createElement(compact?'summary':'h2');heading.textContent='主题皮肤';panel.append(heading);
  const grid=document.createElement('div');grid.className='theme-grid';panel.append(grid);
  const note=document.createElement('p');note.className='theme-note';note.setAttribute('role','status');panel.append(note);
  const nudge=document.createElement('button');nudge.type='button';nudge.className='theme-nudge';nudge.textContent='碰撞演示 · 晃一下';nudge.onclick=()=>themes.nudge();panel.append(nudge);
  for(const theme of THEMES){
    const button=document.createElement('button');button.type='button';button.dataset.theme=theme.id;button.title=theme.note;
    const icon=document.createElement('span');icon.className='theme-thumb';icon.setAttribute('aria-hidden','true');
    if(theme.row>=0){icon.style.backgroundImage=`url("${theme.atlas||THEME_ATLAS}")`;icon.style.backgroundSize=`${(theme.columns||4)*100}% ${(theme.rows||4)*100}%`;icon.style.backgroundPosition=`0 ${theme.row/((theme.rows||4)-1)*100}%`;}
    else {icon.classList.add('theme-thumb-none');icon.textContent='○';}
    const label=document.createElement('span');label.textContent=theme.name;button.append(icon,label);grid.append(button);
    button.onclick=()=>{if(select(theme.id)){onSelect();if(compact)panel.open=false;}};
  }
  parent.append(panel);
  function select(id){
    if(!themes.select(id))return false;
    try{localStorage.setItem(THEME_STORAGE_KEY,id);}catch{}
    return true;
  }
  themes.subscribe((id,status)=>{
    nudge.hidden=!['fishing','tea'].includes(id);nudge.disabled=status!=='ready';
    grid.querySelectorAll('[data-theme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.theme===id)));
    note.textContent=status==='error'&&id!=='none'?'装饰素材未能加载，请刷新重试。':status==='loading'&&id!=='none'?'正在准备主题装饰…':THEMES.find(theme=>theme.id===id).note;
    if(compact)heading.textContent='皮肤 · '+THEMES.find(theme=>theme.id===id).name;
  });
  let saved;try{saved=localStorage.getItem(THEME_STORAGE_KEY);}catch{}
  const requested=new URLSearchParams(location.search).get('theme');
  if(THEMES.some(theme=>theme.id===requested))saved=requested;
  select(THEMES.some(theme=>theme.id===saved)?saved:'none');
  // Selecting a skin with Space must not also start or control the game.
  panel.addEventListener('keydown',event=>event.stopPropagation());
  return {select,panel};
}
