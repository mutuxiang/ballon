import {HAZARDS} from './game-art.js';
export const BARRAGE_STEPS=12,BARRAGE_WARNING=2,BARRAGE_DURATION=10,BARRAGE_INTERVAL=26,HIT_WINDOW=.4,PERFECT_WINDOW=.15;
export const ACTIONS=['up','right','down','left','rotate'];
export const ACTION_LABELS={up:'↑',down:'↓',left:'←',right:'→',rotate:'↻'};
export function defenseAnchor(body){return {x:body.reduce((s,p)=>s+p.x,0)/body.length,y:body.reduce((s,p)=>s+p.y,0)/body.length};}
export class WorkGame {
  constructor(random=Math.random){this.random=random;this.halfWidth=600;this.practiceMode=true;this.reset();}
  reset(){
    this.time=0;this.score=0;this.wave=1;this.air=100;this.invulnerable=0;this.combo=0;this.bestCombo=0;
    this.charge=0;this.lastChargeSide=null;this.lastBeat=-10;this.lastAction=-10;
    this.barrage=null;this.nextBarrageAt=18;
    this.spawnIn=.35;this.attackIndex=0;this.items=[];this.events=[];this.over=false;this.burst=0;
    this.anchor={x:0,y:520};this.anchorInitialized=false;this.feet={left:false,right:false};
    this.sticks={left:{x:0,y:0,enabled:true},right:{x:0,y:0,enabled:false}};
  }
  get barrageState(){return !this.barrage?'idle':this.time<this.barrage.rushAt?'warning':'active';}
  get barrageRemaining(){return this.barrage?Math.max(0,this.barrage.endsAt-this.time):0;}
  get ringRadius(){return Math.min(210,Math.max(100,this.halfWidth-24));}
  get beat(){return Math.max(.9,1.25-(this.wave-1)*.015);}
  get nextNote(){return this.items.filter(o=>!o.safe&&!o.failed&&!o.barrage).sort((a,b)=>a.hitAt-b.hitAt)[0];}
  setViewport(width){if(Number.isFinite(width))this.halfWidth=Math.max(120,width);}
  initializeAnchor(body){
    if(!this.anchorInitialized&&body?.length){this.anchor=defenseAnchor(body);this.anchorInitialized=true;}
  }
  spawnAttack(barrage=false){
    const phrase=['up','right','down','left','rotate','left','up','right','down','rotate'];
    const action=phrase[this.attackIndex%phrase.length],side=this.attackIndex%2?'right':'left';
    // Match the approach side to the required foot, including overhead notes.
    const edge=this.attackIndex%3===0?0:side==='left'?3:1;
    const overheadOffset=Math.min(this.halfWidth*.7,80+this.random()*160);
    const x=edge===1?this.halfWidth+55:edge===3?-this.halfWidth-55:this.anchor.x+(side==='left'?-1:1)*overheadOffset;
    const spread=barrage?440:200,y=edge===0?-55:this.anchor.y-spread/2+this.random()*spread;
    const dx=x-this.anchor.x,dy=y-this.anchor.y,distance=Math.hypot(dx,dy)||1;
    const lead=3.6,speed=Math.max(40,(distance-this.ringRadius)/lead);
    this.items.push({x,y,dx:dx/distance,dy:dy/distance,distance,barrage,speed,hitAt:this.time+lead,action,edge,kind:this.attackIndex%HAZARDS.length,
      side,r:18,angle:Math.atan2(-dy,-dx)-Math.PI/2,spin:0,vx:0,vy:0,safe:false,failed:false,age:0});
    if(barrage){
      // Even angular spacing and three radial lanes keep the rush readable.
      const slot=this.items.length-1,angle=-Math.PI+(slot+.5)*Math.PI/24;
      const item=this.items.at(-1);
      item.dx=Math.cos(angle);item.dy=Math.sin(angle);
      item.barrageRadius=this.ringRadius+90+(slot%3)*85;
      item.distance=item.barrageRadius+440;
      item.x=this.anchor.x+item.dx*item.distance;item.y=this.anchor.y+item.dy*item.distance;
      item.angle=Math.atan2(-item.dy,-item.dx)-Math.PI/2;
    }
    this.attackIndex++;
    // Rotation gets a whole extra beat before and after it.
    this.spawnIn=this.beat*((action==='rotate'||phrase[this.attackIndex%phrase.length]==='rotate')?2:1);
  }
  perform(action,side='left'){
    if(this.over||this.barrage||!ACTIONS.includes(action)||!['left','right'].includes(side)||this.time-this.lastAction<.16)return false;
    this.lastAction=this.time;this.events.push({type:'action',action,side});
    const note=this.nextNote;
    if(!note)return false;
    const offset=this.time-note.hitAt;
    if(Math.abs(offset)>HIT_WINDOW){this.events.push({type:'judge',text:offset<0?'早了一点':'晚了一点',quality:'early'});return false;}
    if(note.action!==action||note.side!==side){note.failed=true;this.combo=0;this.events.push({type:'judge',text:'换个动作',quality:'miss'});return false;}
    const perfect=Math.abs(offset)<=PERFECT_WINDOW;
    this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.air=Math.min(100,this.air+3);
    this.deflect(note,{x:note.dx,y:note.dy},false,perfect?20:10);
    this.events.push({type:'judge',text:perfect?'PERFECT':'GOOD',quality:perfect?'perfect':'good'});
    return true;
  }
  setStick(side,x,y,enabled=true){
    if(!this.sticks[side]||!Number.isFinite(x)||!Number.isFinite(y))return;
    const len=Math.max(1,Math.hypot(x,y));this.sticks[side]={x:x/len,y:y/len,enabled:Boolean(enabled)};
  }
  set(side,down){
    if(!(side in this.feet)||this.over||this.feet[side]===down)return;
    this.feet[side]=down;if(!down)return;
    this.events.push({type:'step',side});
    if(this.barrageState==='active'&&this.time<this.barrage.endsAt&&side!==this.lastChargeSide&&this.time-this.lastBeat>=.09){
      this.lastBeat=this.time;this.lastChargeSide=side;this.charge++;
      if(this.charge>=BARRAGE_STEPS)this.finishBarrage(true);
    }
  }
  startBarrage(){
    if(this.barrage||this.over)return;
    this.items=[];this.charge=0;this.lastChargeSide=null;this.lastBeat=-10;this.release();
    this.barrage={rushAt:this.time+BARRAGE_WARNING,endsAt:this.time+BARRAGE_WARNING+BARRAGE_DURATION};
    for(let i=0;i<24;i++)this.spawnAttack(true);
    this.events.push({type:'barrage-warning'});
  }
  finishBarrage(success){
    if(!this.barrage)return;
    if(success){
      this.burst=1;this.air=Math.min(100,this.air+20);this.invulnerable=1;
      for(const o of this.items)this.deflect(o,{x:o.dx,y:o.dy},true);
      this.events.push({type:'burst'});
    }else{
      this.air=Math.max(0,this.air-56);this.combo=0;this.invulnerable=.6;
      this.events.push({type:'leak',x:this.anchor.x,y:this.anchor.y},{type:'barrage-miss'});
      if(this.air<=0&&!this.practiceMode){this.over=true;this.events.push({type:'pop'});}
    }
    this.items=[];this.barrage=null;this.charge=0;this.lastChargeSide=null;this.release();
    this.nextBarrageAt=this.time+BARRAGE_INTERVAL;this.spawnIn=1.5;
  }
  release(){this.feet.left=this.feet.right=false;}
  deflect(o,direction,burst=false,points=10){
    if(o.safe)return;o.safe=true;o.removed=true;this.score+=points;
    this.events.push({type:'hit',x:o.x,y:o.y});
  }
  update(dt,body){
    if(this.over)return;dt=Math.max(0,Math.min(dt,.035));this.time+=dt;this.initializeAnchor(body);
    this.invulnerable=Math.max(0,this.invulnerable-dt);this.wave=1+Math.floor(this.time/20);this.burst=Math.max(0,this.burst-dt*1.5);
    if(!this.barrage&&this.time>=this.nextBarrageAt)this.startBarrage();
    if(this.barrage){
      if(this.time>=this.barrage.endsAt)this.finishBarrage(false);
      else if(this.time-this.lastBeat>1.5){this.charge=Math.max(0,this.charge-dt*1.4);if(this.charge===0)this.lastChargeSide=null;}
    }else{this.spawnIn-=dt;if(this.spawnIn<=0)this.spawnAttack();}
    for(const o of this.items){
      o.age+=dt;
      if(o.safe){o.x+=o.vx*dt;o.y+=o.vy*dt;o.angle+=o.spin*dt;continue;}
      if(o.barrage){
        const progress=Math.max(0,Math.min(1,(this.time-this.barrage.rushAt)/BARRAGE_DURATION));
        const radius=o.distance*(1-progress)+o.barrageRadius*progress;
        o.x=this.anchor.x+o.dx*radius;o.y=this.anchor.y+o.dy*radius;continue;
      }
      // Center of the object reaches the drawn ring exactly at hitAt.
      const radius=Math.max(0,this.ringRadius+(o.hitAt-this.time)*o.speed);
      o.x=this.anchor.x+o.dx*radius;o.y=this.anchor.y+o.dy*radius;
      if(!o.failed&&this.time>o.hitAt+HIT_WINDOW){o.failed=true;this.combo=0;this.events.push({type:'judge',text:'MISS',quality:'miss'});}
      if(o.failed&&this.time>o.hitAt+.65){
        o.safe=true;o.removed=true;
        if(this.invulnerable<=0){this.air=Math.max(0,this.air-28);this.invulnerable=.6;this.events.push({type:'leak',x:o.x,y:o.y});
          if(this.air<=0&&!this.practiceMode){this.over=true;this.release();this.events.push({type:'pop'});break;}}
      }
    }
    this.items=this.items.filter(o=>!o.removed&&o.age<14&&(o.barrage||(o.y<1100&&o.y>-450&&Math.abs(o.x)<this.halfWidth+450)));
  }
}
