// Gameplay coordinates use an 800-unit viewport; stick axes are screen-space.
export const ULTIMATE_HITS=6, ULTIMATE_STEPS=6;
export class WorkGame {
  constructor(random=Math.random){this.random=random;this.reset();}
  reset(){
    this.time=0;this.score=0;this.wave=1;this.air=100;this.invulnerable=0;
    this.charge=0;this.ultimateHits=0;this.lastBeat=-10;this.lastPump=-10;
    this.spawnIn=1.6;this.items=[];this.events=[];this.over=false;this.burst=0;
    this.feet={left:false,right:false};this.pulses={left:0,right:0};
    this.sticks={left:{x:-.35,y:-.6,enabled:true},right:{x:.35,y:-.6,enabled:false}};
  }
  get ultimateReady(){return this.ultimateHits>=ULTIMATE_HITS;}
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
        for(const o of this.items)this.deflect(o,{x:o.x,y:-250},true);
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
    if(o.safe)return;o.safe=true;const len=Math.hypot(direction.x,direction.y)||1;
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
    if(this.spawnIn<=0){
      const count=Math.min(4,1+Math.floor(this.wave/3));
      for(let i=0;i<count;i++)this.items.push({x:(this.random()-.5)*360,y:-60-i*90,vx:(this.random()-.5)*24,vy:65+Math.min(130,this.wave*12),r:18,angle:0,spin:0,kind:Math.floor(this.random()*4),safe:false});
      this.spawnIn=Math.max(.6,1.7-this.wave*.09);
    }
    const shields=this.shields(body[0]);
    for(const o of this.items){
      o.vy+=dt*(o.safe?70:9);o.x+=o.vx*dt;o.y+=o.vy*dt;o.angle+=o.spin*dt;
      if(!o.safe)for(const s of shields){
        if(s.active&&Math.hypot(o.x-s.x,o.y-s.y)<s.r+o.r&&((o.kind!==1&&o.kind!==3)||s.strong)){
          this.deflect(o,{x:s.dx,y:s.dy});break;
        }
      }
      if(!o.safe&&body.some(p=>Math.hypot(o.x-p.x,o.y+32-p.y)<o.r+p.r)){
        o.safe=true;o.vx=o.x<0?-150:150;o.vy=50;
        if(this.invulnerable<=0){this.air=Math.max(0,this.air-28);this.invulnerable=1.2;this.events.push({type:'leak',x:o.x,y:o.y});
          if(this.air<=0){this.over=true;this.release();this.events.push({type:'pop',x:o.x,y:o.y});break;}}
      }
    }
    this.items=this.items.filter(o=>o.y<900&&o.y>-650&&Math.abs(o.x)<1100);
  }
}
