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
