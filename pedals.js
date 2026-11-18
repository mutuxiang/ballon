import {createCharge} from './charge.js';
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

export function mountPedals({selectState,simulation}){
  const meter=document.createElement('progress');meter.max=1;meter.value=0;meter.setAttribute('aria-label','交替踩踏蓄力');Object.assign(meter.style,{position:'fixed',bottom:'12px',left:'42%',width:'16%',height:'10px',accentColor:'#303430',zIndex:'25',display:'none'});document.body.append(meter);
  let time=0;
  const charge=createCharge(active=>{simulation.superMode=active;window.desktopPet?.focus(active);document.documentElement.classList.toggle('super-mode',active);selectState(active?'high':['none','low','high'][Number(controller.feet.left)+Number(controller.feet.right)]);});
  const controller=createPedals({onState(state,feet){if(!charge.active)selectState(state);simulation.pedalLean=feet.left===feet.right?0:feet.left?-.8:.8;},onBeat({side,down}){
    if(down){charge.beat(side,time);const sign=side==='left'?-1:1;for(let i=12;i<25;i++)simulation.nodes[i].old.x-=sign*.007*(i-12)/12;}
  }});
  if(!window.desktopPet){
    const key=(e,down)=>{if(e.target.matches('input,textarea,select'))return;const side={KeyA:'left',KeyL:'right'}[e.code];if(side){e.preventDefault();controller.set(side,down);}};
    addEventListener('keydown',e=>key(e,true));addEventListener('keyup',e=>key(e,false));addEventListener('blur',()=>controller.reset());
  }
  addEventListener('keydown',e=>{if(e.code==='Escape')charge.cancel();});
  controller.update=dt=>{time+=dt;charge.update(dt,time);meter.value=charge.value;meter.style.display=charge.value>0?'block':'none';};
  controller.cancelSuper=()=>charge.cancel();
  controller.reset();return controller;
}
