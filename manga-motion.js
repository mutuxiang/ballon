import {Vector3} from 'three';

// Screen-space ink follows the projected head. No captions or speech bubbles.
export function createMangaMotion(camera){
  const canvas=document.createElement('canvas');canvas.className='manga-motion';canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'4'});document.body.append(canvas);
  const ctx=canvas.getContext('2d'),previous=new Vector3();let ready=false,time=0,impact=0,fall=0,lastHeight=5.5;
  const project=p=>{const v=p.clone().project(camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};};
  function line(points,width=2){
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.strokeStyle='#fff';ctx.lineWidth=width+2;ctx.stroke();ctx.strokeStyle='#202421';ctx.lineWidth=width;ctx.stroke();
  }
  return {canvas,update(dt,simulation){
    if(dt<=0)return;
    time+=dt;const head=simulation.nodes[24].p;
    const vy=ready?(head.y-previous.y)/dt:0;
    if(ready&&lastHeight>.65&&head.y<=.65&&vy<0)impact=1;
    fall+=((vy<-.12?Math.min(1,-vy/1.2):0)-fall)*Math.min(1,dt*8);
    impact=Math.max(0,impact-dt*1.8);lastHeight=head.y;
    const a=project(head),b=project(ready?previous:head);previous.copy(head);ready=true;
    const dpr=Math.min(devicePixelRatio,2);
    if(canvas.width!==Math.round(innerWidth*dpr)||canvas.height!==Math.round(innerHeight*dpr)){canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,innerWidth,innerHeight);ctx.lineCap='round';ctx.lineJoin='round';
    const scale= Math.max(14,Math.abs(project(head.clone().add(new Vector3(.65,0,0))).x-a.x));
    if(fall>.06){
      ctx.globalAlpha=fall;
      let dx=a.x-b.x,dy=a.y-b.y,len=Math.hypot(dx,dy);if(len<.01){dx=1;dy=1;len=Math.SQRT2;}dx/=len;dy/=len;
      // Two fans outside the face, trailing against the direction of descent.
      for(const side of [-1,1])for(let i=0;i<6;i++){
        const offset=scale*(1.15+i*.17),length=scale*(.6+(i%3)*.3),jitter=Math.sin(i*7+Math.floor(time*12))*.9;
        const x=a.x-dy*offset*side-dx*scale*.25,y=a.y+dx*offset*side-dy*scale*.25;
        line([[x,y],[x-dx*length*.6+jitter,y-dy*length*.6],[x-dx*length,y-dy*length]],i%3===0?2.4:1.2);
      }
    }
    if(impact>0){
      ctx.globalAlpha=Math.min(1,impact*2);
      for(let i=0;i<9;i++){
        const angle=Math.PI*(1.05+i*.11),r=scale*(1.3+(1-impact)*.8),x=a.x+Math.cos(angle)*r,y=a.y+Math.sin(angle)*r;
        line([[x,y],[x+Math.cos(angle)*scale*.18-Math.sin(angle)*scale*.12,y+Math.sin(angle)*scale*.18+Math.cos(angle)*scale*.12],[x+Math.cos(angle)*scale*.55,y+Math.sin(angle)*scale*.55]],2);
      }
    }
    ctx.globalAlpha=1;
  }};
}
