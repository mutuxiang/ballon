export function createPedals({onState,onBeat}){
  const feet={left:false,right:false};let lastSide=null,lastTime=-Infinity,combo=0;
  return {feet,
    set(side,down,time=performance.now()){
      if(!(side in feet)||feet[side]===down)return;
      feet[side]=down;
      const count=Number(feet.left)+Number(feet.right);
      onState(['none','low','high'][count],feet);
      if(down){combo=lastSide&&lastSide!==side&&time-lastTime<1600?combo+1:1;lastSide=side;lastTime=time;}
      onBeat({count,side,down,combo:down?combo:0});
    },
    reset(){feet.left=false;feet.right=false;combo=0;lastSide=null;onState('none',feet);}
  };
}

export function mountPedals({selectState,simulation,petMode}){
  const panel=document.createElement('div');panel.className='pedal-console';
  panel.innerHTML='<button data-foot="left">左脚 A</button><span>脚下续气</span><button data-foot="right">右脚 L</button>';
  const bubble=document.createElement('div');bubble.className='pedal-bubble';bubble.setAttribute('aria-live','polite');
  document.body.append(panel,bubble);
  const style=document.createElement('style');style.textContent=`
    .pedal-console{position:fixed;bottom:85px;left:40px;display:flex;align-items:center;gap:10px;font:12px 'Microsoft YaHei';z-index:20;color:#23382e}
    .pedal-console button{border:2px solid #303b34;background:#fffdf4;padding:8px 14px;min-height:36px}
    .pedal-console button[aria-pressed=true]{background:#b6dcc4;transform:translateY(3px)}
    .pedal-bubble{position:fixed;left:48%;top:14%;pointer-events:none;z-index:30;background:#fff9d9;color:#26372d;border:3px solid #303b34;border-radius:45% 48% 35% 42%;padding:14px 22px;font:bold 22px 'Microsoft YaHei';opacity:0;transform:rotate(-8deg) scale(.8);transition:opacity .12s,transform .16s;box-shadow:5px 5px 0 #303b34}
    .pedal-bubble.show{opacity:1;transform:rotate(-8deg) scale(1)}
    .desktop-pet .pedal-console{bottom:3px;left:50%;transform:translateX(-50%);opacity:.85}.desktop-pet .pedal-console span{display:none}.desktop-pet .pedal-console button{padding:3px 10px;min-height:24px;font-size:10px}.desktop-pet .pedal-bubble{top:5%;left:54%;font-size:17px;padding:10px 15px}
  `;document.head.append(style);
  let timer;
  const controller=createPedals({onState(state,feet){selectState(state);simulation.pedalLean=feet.left===feet.right?0:feet.left?-.8:.8;for(const button of panel.querySelectorAll('button'))button.setAttribute('aria-pressed',String(feet[button.dataset.foot]));},onBeat({count,side,down,combo}){
    bubble.textContent=combo>=4?'哒哒哒！工位小舞步':count===2?'砰！打工人上线！':count===1?(side==='left'&&down?'左边还在营业…':'嘶——半格电摸鱼'):'呼——离座放空';
    bubble.classList.remove('show');requestAnimationFrame(()=>bubble.classList.add('show'));clearTimeout(timer);timer=setTimeout(()=>bubble.classList.remove('show'),1800);
    if(down){const sign=side==='left'?-1:1;for(let i=12;i<25;i++)simulation.nodes[i].old.x-=sign*.007*(i-12)/12;}
  }});
  for(const button of panel.querySelectorAll('button')){
    button.onpointerdown=e=>{button.setPointerCapture(e.pointerId);controller.set(button.dataset.foot,true);};
    button.onpointerup=button.onpointercancel=()=>controller.set(button.dataset.foot,false);
  }
  if(!window.desktopPet){
    const key=(e,down)=>{if(e.target.matches('input,textarea,select'))return;const side={KeyA:'left',KeyL:'right'}[e.code];if(side){e.preventDefault();controller.set(side,down);}};
    addEventListener('keydown',e=>key(e,true));addEventListener('keyup',e=>key(e,false));addEventListener('blur',()=>controller.reset());
  }
  controller.reset();return controller;
}
