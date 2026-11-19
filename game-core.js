// Rendering-independent gameplay. Coordinates use an 800-unit tall viewport.
export class WorkGame {
  constructor(random=Math.random){this.random=random;this.reset();}
  reset(){this.time=0;this.score=0;this.wave=1;this.air=100;this.invulnerable=0;this.aim=0;this.charge=0;this.lastSide=null;this.lastBeat=-10;this.spawnIn=1.6;this.items=[];this.feet={left:false,right:false};this.pulses={left:0,right:0};this.events=[];this.over=false;this.burst=0;this.lastPump=-10;}
  set(side,down){
    if(!(side in this.feet)||this.over||this.feet[side]===down)return;
    this.feet[side]=down;
    if(!down)return;
    this.pulses[side]=1;this.events.push({type:'step',side});
    if(this.time-this.lastPump>.22){this.air=Math.min(100,this.air+1.5);this.lastPump=this.time;}
    if(this.lastSide!==side&&this.time-this.lastBeat<1.6)this.charge=Math.min(10,this.charge+1);
    else if(this.lastSide===null||this.time-this.lastBeat>=1.6)this.charge=1;
    this.lastSide=side;this.lastBeat=this.time;
    if(this.charge>=10){this.charge=0;this.lastSide=null;this.burst=1;for(const o of this.items)this.deflect(o,o.x<0?-1:1,true);this.events.push({type:'burst'});}
  }
  release(){this.feet.left=this.feet.right=false;}
  shields(head){return ['left','right'].map((side,i)=>({side,x:head.x+this.aim+(i?72:-72),y:head.y-94-this.pulses[side]*32,r:this.feet[side]?64:28,active:this.feet[side],strong:this.pulses[side]>.35,sign:i?1:-1}));}
  deflect(o,sign,burst=false){if(o.safe)return;o.safe=true;o.vx=sign*(260+this.random()*140);o.vy=burst?-220:-100;o.spin=sign*5;this.score+=10;this.events.push({type:'hit',x:o.x,y:o.y});}
  update(dt,body){
    if(this.over)return;dt=Math.min(dt,.035);this.time+=dt;this.invulnerable=Math.max(0,this.invulnerable-dt);this.wave=1+Math.floor(this.time/20);this.burst=Math.max(0,this.burst-dt*1.5);
    for(const side of ['left','right'])this.pulses[side]=Math.max(0,this.pulses[side]-dt*2.8);
    if(this.time-this.lastBeat>1.6)this.charge=Math.max(0,this.charge-dt*1.2);
    this.spawnIn-=dt;
    if(this.spawnIn<=0){
      const count=Math.min(4,1+Math.floor(this.wave/3));
      for(let i=0;i<count;i++){const x=(this.random()-.5)*360;this.items.push({x,y:-60-i*90,vx:(this.random()-.5)*24,vy:65+Math.min(130,this.wave*12),r:18,angle:0,spin:0,kind:Math.floor(this.random()*4),safe:false});}
      this.spawnIn=Math.max(.6,1.7-this.wave*.09);
    }
    const shields=this.shields(body[0]);
    // Small bounded steps avoid tunnelling even after a slow frame.
    for(const o of this.items){o.vy+=dt*(o.safe?70:9);o.x+=o.vx*dt;o.y+=o.vy*dt;o.angle+=o.spin*dt;
      if(!o.safe){for(const s of shields)if(s.active&&Math.hypot(o.x-s.x,o.y-s.y)<s.r+o.r){if((o.kind!==1&&o.kind!==3)||s.strong)this.deflect(o,s.sign);break;}}
      if(!o.safe&&body.some(p=>Math.hypot(o.x-p.x,o.y+32-p.y)<o.r+p.r)){
        o.safe=true;o.vx=o.x<0?-150:150;o.vy=50;
        if(this.invulnerable<=0){this.air=Math.max(0,this.air-28);this.invulnerable=1.2;this.events.push({type:'leak',x:o.x,y:o.y});if(this.air<=0){this.over=true;this.release();this.events.push({type:'pop',x:o.x,y:o.y});break;}}
      }
    }
    this.items=this.items.filter(o=>o.y<900&&Math.abs(o.x)<1100);
  }
}
