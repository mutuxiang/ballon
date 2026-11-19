// Event reactions override ambient movement; no random expression slideshow.
export function gameExpression({over,burst,hurt,charge,hit,air,threat,motionSkin}){
  if(over)return 'narrow';
  if(burst>0)return 'sparkle-grin';
  if(hurt>0)return 'pout';
  if(charge>0)return 'sparkle';
  if(hit>0)return 'confident';
  if(air<35)return 'sleepy-grin';
  if(threat)return 'narrow';
  return motionSkin||'chill';
}

// Let each reaction read before returning to ambient motion. Only damage,
// the ultimate, or game over can interrupt a recently selected expression.
export function createGameExpressions(){
  let current='',age=0,rank=0,pending='',settled=0;
  return {
    reset(){current='';age=0;rank=0;pending='';settled=0;},
    update(dt,state){
      age+=dt;
      const next=gameExpression(state);
      const priority=state.over?4:state.burst>0?3:state.hurt>0?2:0;
      if(next===current){pending='';settled=0;return current;}
      if(pending!==next){pending=next;settled=0;}else settled+=dt;
      if(!current||(priority>rank&&priority>0)||(age>=2.2&&settled>=.5)){
        current=next;rank=priority;age=0;pending='';settled=0;
      }
      return current;
    }
  };
}
