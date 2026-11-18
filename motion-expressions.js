import {SKINS} from './skins.js';

const allowed=new Set(SKINS.filter(skin=>skin.id!=='original').map(skin=>skin.id));
export const MIN_EXPRESSION_HOLD=.85;
const SETTLE_TIME=.22;

// Priority reflects actual motion, not a random slideshow or just the air button.
export function classifyMotion({height,pressure,target,speed,verticalSpeed,lean}){
  if(height<1.35||pressure<.16)return {state:'rest',skin:'narrow',label:'躺平休息'};
  if(target<pressure-.10&&verticalSpeed<-.14)return {state:'falling',skin:'pout',label:'泄气下坠'};
  if(target>pressure+.10||(verticalSpeed>.34&&height<4.6))return {state:'inflating',skin:'sparkle',label:'充气抬头'};
  if(lean>.72||height<3.4)return {state:'folded',skin:'sleepy-grin',label:'弯折撑住'};
  if(speed>.85&&lean>.22)return {state:'swinging',skin:'sparkle-grin',label:'大幅摇摆'};
  if(verticalSpeed>.15)return {state:'rising',skin:'smile',label:'上扬回弹'};
  if(lean>.22||speed>.28)return {state:'swaying',skin:'chill',label:'轻轻摇摆'};
  if(pressure>.62)return {state:'steady',skin:'confident',label:'稳稳站立'};
  return {state:'idle',skin:'narrow',label:'平缓放松'};
}

export function createMotionExpressions(onChange){
  let enabled=false,elapsed=0,lastChange=0,pending=null,pendingTime=0,current=null;
  let previous=null,smoothedSpeed=0,smoothedVertical=0;
  function measure(dt,simulation){
    const head=simulation.nodes[24],base=simulation.nodes[0].p,p=head.p;
    if(dt>0&&previous){
      const vx=(p.x-previous.x)/dt,vy=(p.y-previous.y)/dt,vz=(p.z-previous.z)/dt;
      const weight=1-Math.exp(-dt*7);
      smoothedSpeed+=(Math.min(10,Math.hypot(vx,vy,vz))-smoothedSpeed)*weight;
      smoothedVertical+=(Math.max(-10,Math.min(10,vy))-smoothedVertical)*weight;
    }
    previous={x:p.x,y:p.y,z:p.z};
    return {height:p.y,pressure:head.pressure,target:simulation.target,speed:smoothedSpeed,verticalSpeed:smoothedVertical,
      lean:Math.atan2(Math.hypot(p.x-base.x,p.z-base.z),Math.max(.001,p.y-base.y))};
  }
  function apply(candidate){
    if(!allowed.has(candidate.skin))return;
    current=candidate;lastChange=elapsed;pending=null;pendingTime=0;
    onChange(candidate.skin,candidate.label);
  }
  return {
    get enabled(){return enabled;},get state(){return current?.state??null;},get skin(){return current?.skin??null;},
    setEnabled(value,simulation){
      const next=Boolean(value);if(next===enabled)return;
      enabled=next;previous=null;smoothedSpeed=0;smoothedVertical=0;pending=null;pendingTime=0;elapsed=0;lastChange=0;
      if(enabled)apply(classifyMotion(measure(0,simulation)));
    },
    update(dt,simulation){
      if(!enabled||!Number.isFinite(dt)||dt<=0)return;
      const delta=Math.min(dt,.1);elapsed+=delta;
      const candidate=classifyMotion(measure(delta,simulation));
      if(candidate.state===current?.state){pending=null;pendingTime=0;return;}
      if(pending?.state!==candidate.state){pending=candidate;pendingTime=0;}
      else pendingTime+=delta;
      if(pendingTime>=SETTLE_TIME&&elapsed-lastChange>=MIN_EXPRESSION_HOLD)apply(candidate);
    }
  };
}
