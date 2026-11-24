const api=window.petMenu;
const resize=()=>api.height(document.querySelector('.menu').offsetHeight+24);
new ResizeObserver(resize).observe(document.querySelector('.menu'));
async function act(action,value){
  const error=document.querySelector('#error');error.hidden=true;
  try{await api.action(action,value);}catch(e){error.textContent=e.message;error.hidden=false;resize();}
}
document.querySelectorAll('[data-action]').forEach(button=>button.onclick=()=>act(button.dataset.action));
document.querySelectorAll('[data-panel]').forEach(button=>button.onclick=()=>{
  const expanded=button.getAttribute('aria-expanded')==='true';
  document.querySelectorAll('[data-panel]').forEach(other=>{
    const open=other===button&&!expanded;other.setAttribute('aria-expanded',String(open));document.getElementById(other.dataset.panel).hidden=!open;
  });resize();
});
api.state().then(state=>{
  const themeArt={
    fishing:{url:'../dist/break-skin-atlas-v1.png',size:'400% 400%',position:'0% 0%'},
    breathe:{url:'../dist/relax-neck-pillow-v2.png',size:'contain',position:'center'},
    fresh:{url:'../dist/break-skin-atlas-v1.png',size:'400% 400%',position:'0% 66.6667%'},
    tea:{url:'../dist/break-skin-atlas-v1.png',size:'400% 400%',position:'0% 100%'},
    wind:{url:'../dist/wind-skin-atlas-v1.png',size:'300% 300%',position:'50% 0%'}
  };
  for(const theme of state.themes){
    const button=document.createElement('button'),icon=document.createElement('span'),label=document.createElement('span');
    icon.className='theme-mini';icon.setAttribute('aria-hidden','true');
    const art=themeArt[theme.id];
    if(art){icon.style.backgroundImage=`url("${art.url}")`;icon.style.backgroundSize=art.size;icon.style.backgroundPosition=art.position;}
    else icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="#4d716e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 4-5 3 2 5 3-1v9h8v-9l3 1 2-5-5-3c0 2-1.4 3-4 3S8 6 8 4Z" fill="#d6e7e3"/></svg>';
    label.textContent=theme.name;label.className='theme-label';button.append(icon,label);
    button.setAttribute('aria-pressed',String(theme.id===state.theme));button.onclick=()=>act('theme',theme.id);document.querySelector('#themes').append(button);
  }
  if(state.unlocks?.length){
    for(const slot of state.unlocks){
      const card=document.createElement('section');card.className='skin-unlock'+(slot.achieved?' achieved':'');card.dataset.unlock=slot.id;
      const icon=document.createElement('span');icon.className='unlock-icon';icon.setAttribute('aria-hidden','true');
      icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></svg>';
      if(slot.achieved)icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/></svg>';
      const content=document.createElement('div'),name=document.createElement('strong'),condition=document.createElement('span'),progress=document.createElement('progress');
      name.textContent=slot.achieved?'已解锁皮肤':'待解锁皮肤';
      card.tabIndex=0;
      condition.textContent=slot.achieved?'新皮肤准备中，解锁资格已保留':Math.min(slot.current,slot.target)+' / '+slot.target+' 经验';
      progress.max=slot.target;progress.value=Math.min(slot.current,slot.target);progress.setAttribute('aria-label',slot.name+'解锁进度');
      const detail=document.createElement('div');detail.className='unlock-detail';detail.append(condition,progress);content.append(name,detail);card.append(icon,content);document.querySelector('#themes').append(card);
    }
  }
  for(const size of [.5,.75,1,1.25,1.5]){
    const button=document.createElement('button');button.textContent=Math.round(size*100)+'%'+(size===1?' · 默认':'');button.setAttribute('aria-pressed',String(size===state.scale));button.onclick=()=>act('size',size);document.querySelector('#sizes').append(button);
  }
  resize();document.querySelector('.entry').focus();
});
addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();api.close();}
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
    event.preventDefault();const buttons=[...document.querySelectorAll('button')].filter(button=>button.offsetHeight>0),index=buttons.indexOf(document.activeElement);
    const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();
  }
});
