export function createCharge(onSuper){
  let value=0,lastSide=null,lastTime=-Infinity,remaining=0;
  return {
    get value(){return value;},get active(){return remaining>0;},
    beat(side,time){
      if(remaining>0)return;
      value=lastSide&&side!==lastSide&&time-lastTime<1.5?Math.min(1,value+.1):.1;
      lastSide=side;lastTime=time;
      if(value>=.999){remaining=15;value=1;onSuper(true);}
    },
    update(dt,time){
      if(remaining>0){remaining-=dt;if(remaining<=0)this.cancel();}
      else if(time-lastTime>1.5)value=Math.max(0,value-dt*.3);
    },
    cancel(){remaining=0;value=0;lastSide=null;onSuper(false);}
  };
}
