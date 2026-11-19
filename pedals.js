import {Vector3} from 'three';
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

export function mountPedals({selectState,simulation,camera}){
  const meter=document.createElement('div');meter.setAttribute('role','progressbar');meter.setAttribute('aria-label','交替踩踏蓄力');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');Object.assign(meter.style,{position:'fixed',top:'0px',left:'50%',transform:'translateX(-50%)',width:'220px',height:'74px',zIndex:'25',display:'none',pointerEvents:'none'});
  const frame=document.createElement('img');frame.src='./manga-charge-frame.png';Object.assign(frame.style,{width:'100%',height:'100%',position:'absolute'});
  const track=document.createElement('div');Object.assign(track.style,{position:'absolute',left:'8%',top:'39%',width:'84%',height:'22%',borderRadius:'12px',overflow:'hidden'});
  const fill=document.createElement('div');Object.assign(fill.style,{height:'100%',width:'0%',background:'repeating-linear-gradient(125deg,#252525 0 3px,#888 3px 4px)',transition:'width .1s linear'});track.append(fill);meter.append(frame,track);document.body.append(meter);
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
  controller.update=dt=>{const head=simulation.nodes[24].p.clone().add(new Vector3(0,.65,0)).project(camera);meter.style.left=Math.max(115,Math.min(innerWidth-115,(head.x+1)*innerWidth/2))+'px';meter.style.top=Math.max(-12,Math.min(innerHeight-74,(1-head.y)*innerHeight/2-37))+'px';time+=dt;charge.update(dt,time);fill.style.width=charge.value*100+'%';meter.setAttribute('aria-valuenow',String(Math.round(charge.value*100)));meter.style.display=charge.value>0?'block':'none';};
  controller.cancelSuper=()=>charge.cancel();
  controller.reset();return controller;
}
