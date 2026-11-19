export const ULTIMATE_HITS=6,ULTIMATE_STEPS=6,HIT_WINDOW=.25,PERFECT_WINDOW=.09;
export const ACTIONS=['up','right','down','left','rotate'];
export const ACTION_LABELS={up:'↑',down:'↓',left:'←',right:'→',rotate:'↻'};
export function defenseAnchor(body){return {x:body.reduce((s,p)=>s+p.x,0)/body.length,y:body.reduce((s,p)=>s+p.y,0)/body.length};}
export class WorkGame {
  constructor(random=Math.random){this.random=random;this.halfWidth=600;this.reset();}
  reset(){
    this.time=0;this.score=0;this.wave=1;this.air=100;this.invulnerable=0;this.combo=0;this.bestCombo=0;
    this.charge=0;this.ultimateHits=0;this.lastBeat=-10;this.lastAction=-10;
    this.spawnIn=.35;this.attackIndex=0;this.items=[];this.events=[];this.over=false;this.burst=0;
    this.anchor={x:0,y:520};this.feet={left:false,right:false};
    this.sticks={left:{x:0,y:0,enabled:true},right:{x:0,y:0,enabled:false}};
  }
  get ultimateReady(){return this.ultimateHits>=ULTIMATE_HITS;}
  get ringRadius(){return Math.min(190,Math.max(100,this.halfWidth-24));}
  get beat(){return Math.max(.68,.92-(this.wave-1)*.025);}
  get nextNote(){return this.items.filter(o=>!o.safe&&!o.failed).sort((a,b)=>a.hitAt-b.hitAt)[0];}
  setViewport(width){if(Number.isFinite(width))this.halfWidth=Math.max(120,width);}
  spawnAttack(){
    const phrase=['up','right','down','left','rotate','left','up','right','down','rotate'];
    const action=phrase[this.attackIndex%phrase.length],edge=[0,1,3][this.attackIndex%3];
    const x=edge===1?this.halfWidth+55:edge===3?-this.halfWidth-55:(this.random()-.5)*Math.min(400,this.halfWidth);
    const y=edge===0?-55:this.anchor.y-100+this.random()*200;
    const dx=x-this.anchor.x,dy=y-this.anchor.y,distance=Math.hypot(dx,dy)||1;
    const lead=2.8,speed=Math.max(40,(distance-this.ringRadius)/lead);
    this.items.push({x,y,dx:dx/distance,dy:dy/distance,speed,hitAt:this.time+lead,action,edge,kind:this.attackIndex%4,
      side:this.attackIndex%2?'right':'left',r:18,angle:Math.atan2(-dy,-dx)-Math.PI/2,spin:0,vx:0,vy:0,safe:false,failed:false,age:0});
    this.attackIndex++;
    // Rotation gets a whole extra beat before and after it.
    this.spawnIn=this.beat*((action==='rotate'||phrase[this.attackIndex%phrase.length]==='rotate')?2:1);
  }
  perform(action,side='left'){
    if(this.over||!ACTIONS.includes(action)||!['left','right'].includes(side)||this.time-this.lastAction<.16)return false;
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
    if(this.ultimateReady&&this.time-this.lastBeat>=.15){
      this.lastBeat=this.time;this.charge++;
      if(this.charge>=ULTIMATE_STEPS){
        this.charge=0;this.ultimateHits=0;this.burst=1;this.air=Math.min(100,this.air+20);this.invulnerable=1;
        for(const o of this.items)this.deflect(o,{x:o.x-this.anchor.x,y:o.y-this.anchor.y},true);
        this.events.push({type:'burst'});
      }
    }
  }
  release(){this.feet.left=this.feet.right=false;}
  deflect(o,direction,burst=false,points=10){
    if(o.safe)return;o.safe=true;const len=Math.hypot(direction.x,direction.y)||1;
    o.vx=direction.x/len*400;o.vy=direction.y/len*400;o.spin=(direction.x<0?-1:1)*5;this.score+=points;
    if(!burst){const ready=this.ultimateReady;this.ultimateHits=Math.min(ULTIMATE_HITS,this.ultimateHits+1);if(!ready&&this.ultimateReady)this.events.push({type:'ultimate-ready'});}
    this.events.push({type:'hit',x:o.x,y:o.y});
  }
  update(dt,body){
    if(this.over)return;dt=Math.max(0,Math.min(dt,.035));this.time+=dt;this.anchor=defenseAnchor(body);
    this.invulnerable=Math.max(0,this.invulnerable-dt);this.wave=1+Math.floor(this.time/20);this.burst=Math.max(0,this.burst-dt*1.5);
    if(this.time-this.lastBeat>2)this.charge=Math.max(0,this.charge-dt*1.2);
    this.spawnIn-=dt;if(this.spawnIn<=0)this.spawnAttack();
    for(const o of this.items){
      o.age+=dt;
      if(o.safe){o.x+=o.vx*dt;o.y+=o.vy*dt;o.angle+=o.spin*dt;continue;}
      // Center of the object reaches the drawn ring exactly at hitAt.
      const radius=Math.max(0,this.ringRadius+(o.hitAt-this.time)*o.speed);
      o.x=this.anchor.x+o.dx*radius;o.y=this.anchor.y+o.dy*radius;
      if(!o.failed&&this.time>o.hitAt+HIT_WINDOW){o.failed=true;this.combo=0;this.events.push({type:'judge',text:'MISS',quality:'miss'});}
      if(o.failed&&this.time>o.hitAt+.65){
        o.safe=true;o.vx=o.dx*120;o.vy=o.dy*120;
        if(this.invulnerable<=0){this.air=Math.max(0,this.air-28);this.invulnerable=.6;this.events.push({type:'leak',x:o.x,y:o.y});
          if(this.air<=0){this.over=true;this.release();this.events.push({type:'pop'});break;}}
      }
    }
    this.items=this.items.filter(o=>o.age<14&&o.y<1100&&o.y>-450&&Math.abs(o.x)<this.halfWidth+450);
  }
}
