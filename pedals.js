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
  const controller=createPedals({onState(state,feet){selectState(state);simulation.pedalLean=feet.left===feet.right?0:feet.left?-.8:.8;},onBeat({side,down}){
    if(down){const sign=side==='left'?-1:1;for(let i=12;i<25;i++)simulation.nodes[i].old.x-=sign*.007*(i-12)/12;}
  }});
  if(!window.desktopPet){
    const key=(e,down)=>{if(e.target.matches('input,textarea,select'))return;const side={KeyA:'left',KeyL:'right'}[e.code];if(side){e.preventDefault();controller.set(side,down);}};
    addEventListener('keydown',e=>key(e,true));addEventListener('keyup',e=>key(e,false));addEventListener('blur',()=>controller.reset());
  }
  controller.reset();return controller;
}
