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
  for(const theme of state.themes){
    const button=document.createElement('button');button.textContent=theme.name;button.setAttribute('aria-pressed',String(theme.id===state.theme));button.onclick=()=>act('theme',theme.id);document.querySelector('#themes').append(button);
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
