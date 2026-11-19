// Gameplay coordinates use an 800-unit viewport; stick axes are screen-space.
export const ULTIMATE_HITS=6, ULTIMATE_STEPS=6;
export function defenseAnchor(body){return {x:body.reduce((sum,p)=>sum+p.x,0)/body.length,y:body.reduce((sum,p)=>sum+p.y,0)/body.length};}
export class WorkGame {
  constructor(random=Math.random){this.random=random;this.reset();}
  reset(){
    this.time=0;this.score=0;this.wave=1;this.air=100;this.invulnerable=0;
    this.charge=0;this.ultimateHits=0;this.lastBeat=-10;this.lastPump=-10;
    this.spawnIn=1.6;this.attackIndex=0;this.halfWidth??=600;this.items=[];this.events=[];this.over=false;this.burst=0;
    this.feet={left:false,right:false};this.pulses={left:0,right:0};
    this.sticks={left:{x:-.35,y:-.6,enabled:true},right:{x:.35,y:-.6,enabled:false}};
  }
  get ultimateReady(){return this.ultimateHits>=ULTIMATE_HITS;}
  setViewport(halfWidth){if(Number.isFinite(halfWidth))this.halfWidth=Math.max(120,halfWidth);}
  spawnAttack(body){
    // Rotate origins so all four edges appear early; alternate single shots,
    // staggered crossfire and three-shot fans rather than a vertical rain.
    const pattern=this.attackIndex%3,edge=this.attackIndex%4;
    const count=pattern===0?1:pattern===1?2:3;
    for(let i=0;i<count;i++){
      const from=pattern===1?(edge+i*2)%4:edge;
      const spread=(this.random()-.5)*Math.min(520,this.halfWidth*1.5);
      const x=from===1?this.halfWidth+55:from===3?-this.halfWidth-55:spread+(i-(count-1)/2)*35;
      const y=from===0?-55:from===2?855:150+this.random()*520;
      const target=body[Math.floor(this.random()*Math.max(1,Math.ceil(body.length*.7)))];
      const dx=target.x-x,dy=target.y-y,distance=Math.hypot(dx,dy)||1;
      const speed=Math.min(340,Math.max(110,distance/(3.3-Math.min(1.4,this.wave*.13))));
      this.items.push({x,y,vx:dx/distance*speed,vy:dy/distance*speed,r:18,angle:Math.atan2(dy,dx)-Math.PI/2,spin:0,
        kind:Math.floor(this.random()*4),safe:false,warning:.75+i*.4,age:0,edge:from,speed});
    }
    this.events.push({type:'attack',pattern:['突袭','交叉夹击','三连追击'][pattern]});
    this.attackIndex++;
    this.spawnIn=Math.max(1.5,3.5-this.wave*.13)+(count-1)*.35;
  }
  setStick(side,x,y,enabled=true){
    if(!this.sticks[side]||!Number.isFinite(x)||!Number.isFinite(y))return;
    const length=Math.max(1,Math.hypot(x,y));
    this.sticks[side]={x:x/length,y:y/length,enabled:Boolean(enabled)};
    if(!enabled){this.feet[side]=false;this.pulses[side]=0;}
  }
  set(side,down){
    if(!(side in this.feet)||!this.sticks[side].enabled||this.over||this.feet[side]===down)return;
    this.feet[side]=down;if(!down)return;
    this.pulses[side]=1;this.events.push({type:'step',side});
    if(this.time-this.lastPump>.22){this.air=Math.min(100,this.air+1.5);this.lastPump=this.time;}
    // Actual down edges charge, including repeated presses of ONE pedal.
    if(this.ultimateReady&&this.time-this.lastBeat>=.15){
      this.lastBeat=this.time;this.charge=Math.min(ULTIMATE_STEPS,this.charge+1);
      if(this.charge>=ULTIMATE_STEPS){
        this.charge=0;this.ultimateHits=0;this.burst=1;this.air=Math.min(100,this.air+20);this.invulnerable=1;
        for(const o of this.items)this.deflect(o,{x:o.x-(this.anchor?.x||0),y:o.y-(this.anchor?.y||400)},true);
        this.events.push({type:'burst'});
      }
    }
  }
  release(){this.feet.left=this.feet.right=false;}
  shields(head){return Object.entries(this.sticks).map(([side,s])=>{
    const len=Math.hypot(s.x,s.y),dx=len>.05?s.x/len:0,dy=len>.05?s.y/len:-1;
    return {side,x:head.x+s.x*220,y:head.y+s.y*220,r:this.pulses[side]>.35?65:36,
      active:s.enabled,strong:this.pulses[side]>.35,dx,dy};
  });}
  deflect(o,direction,burst=false){
    if(o.safe)return;o.safe=true;o.warning=0;const len=Math.hypot(direction.x,direction.y)||1;
    o.vx=direction.x/len*380;o.vy=direction.y/len*380;o.spin=(direction.x<0?-1:1)*5;
    this.score+=10;
    if(!burst){const wasReady=this.ultimateReady;this.ultimateHits=Math.min(ULTIMATE_HITS,this.ultimateHits+1);if(!wasReady&&this.ultimateReady)this.events.push({type:'ultimate-ready'});}
    this.events.push({type:'hit',x:o.x,y:o.y});
  }
  update(dt,body){
    if(this.over)return;dt=Math.max(0,Math.min(dt,.035));this.time+=dt;
    this.invulnerable=Math.max(0,this.invulnerable-dt);this.wave=1+Math.floor(this.time/20);this.burst=Math.max(0,this.burst-dt*1.5);
    for(const side of ['left','right'])this.pulses[side]=Math.max(0,this.pulses[side]-dt*2.8);
    if(this.time-this.lastBeat>2)this.charge=Math.max(0,this.charge-dt*1.2);
    this.spawnIn-=dt;
    if(this.spawnIn<=0)this.spawnAttack(body);
    this.anchor=defenseAnchor(body);
    const shields=this.shields(this.anchor);
    for(const o of this.items){
      if(o.warning>0){o.warning=Math.max(0,o.warning-dt);continue;}
      o.age=(o.age||0)+dt;
      // Paper planes gently track for their first second, then commit. Other
      // threats keep their announced trajectory, leaving a readable dodge.
      if(!o.safe&&o.kind===2&&o.age<1.1&&o.speed){
        const target=body[0],a=Math.atan2(o.vy,o.vx),wanted=Math.atan2(target.y-o.y,target.x-o.x);
        const delta=Math.atan2(Math.sin(wanted-a),Math.cos(wanted-a));
        const turn=Math.max(-dt*.65,Math.min(dt*.65,delta));
        o.vx=Math.cos(a+turn)*o.speed;o.vy=Math.sin(a+turn)*o.speed;
      }
      if(o.safe)o.vy+=dt*70;
      o.x+=o.vx*dt;o.y+=o.vy*dt;
      o.angle=o.safe?o.angle+o.spin*dt:Math.hypot(o.vx,o.vy)>.01?Math.atan2(o.vy,o.vx)-Math.PI/2:o.angle;
      if(!o.safe)for(const s of shields){
        if(s.active&&Math.hypot(o.x-s.x,o.y-s.y)<s.r+o.r&&((o.kind!==1&&o.kind!==3)||s.strong)){
          this.deflect(o,{x:s.dx,y:s.dy});break;
        }
      }
      const tipX=o.x-Math.sin(o.angle)*32,tipY=o.y+Math.cos(o.angle)*32;
      if(!o.safe&&body.some(p=>Math.hypot(tipX-p.x,tipY-p.y)<o.r+p.r)){
        o.safe=true;o.vx=o.x<0?-150:150;o.vy=50;
        if(this.invulnerable<=0){this.air=Math.max(0,this.air-28);this.invulnerable=1.2;this.events.push({type:'leak',x:o.x,y:o.y});
          if(this.air<=0){this.over=true;this.release();this.events.push({type:'pop',x:o.x,y:o.y});break;}}
      }
    }
    this.items=this.items.filter(o=>(o.age||0)<13&&o.y<1100&&o.y>-350&&Math.abs(o.x)<this.halfWidth+350);
  }
}
