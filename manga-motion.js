import {Vector3} from 'three';
export function createMangaMotion(camera){
  const canvas=document.createElement('canvas');canvas.className='manga-motion';canvas.setAttribute('aria-hidden','true');Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'4'});document.body.append(canvas);
  const style=document.createElement('style');style.textContent='.super-mode body{background:#f4eedb!important}.desktop-pet.super-mode body{background:#f4eedbf5!important}';document.head.append(style);
  const ctx=canvas.getContext('2d');let time=0,previous=null,rise=0;
  const project=p=>{const v=p.clone().project(camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};};
  return {canvas,update(dt,sim){
    if(dt<=0)return;time+=dt;const head=sim.nodes[24].p,vy=previous===null?0:(head.y-previous)/dt;previous=head.y;
    rise+=((vy>.18?1:0)-rise)*Math.min(1,dt*7);
    const dpr=Math.min(devicePixelRatio,2);if(canvas.width!==Math.round(innerWidth*dpr)||canvas.height!==Math.round(innerHeight*dpr)){canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,innerWidth,innerHeight);
    const a=project(head),r=Math.max(18,Math.abs(project(head.clone().add(new Vector3(.8,0,0))).x-a.x));
    ctx.strokeStyle='#202421';ctx.lineCap='round';
    if(sim.superMode){
      const frame=Math.floor(time*12);
      for(let i=0;i<48;i++){
        const angle=i*Math.PI*2/48,inner=r*(2.1+Math.sin(i*7+frame)*.3),outer=inner+r*(1.2+(i%4)*.5);
        ctx.beginPath();ctx.moveTo(a.x+Math.cos(angle)*inner,a.y+Math.sin(angle)*inner);ctx.lineTo(a.x+Math.cos(angle)*outer,a.y+Math.sin(angle)*outer);ctx.lineWidth=i%5===0?2.5:1;ctx.stroke();
      }
      ctx.strokeStyle='#d69c17';ctx.lineWidth=3;ctx.beginPath();
      for(let i=0;i<=32;i++){const angle=i/32*Math.PI*2,rr=r*(1.8+(i%2)*.32+Math.sin(time*15+i)*.08);const x=a.x+Math.cos(angle)*rr,y=a.y+Math.sin(angle)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.stroke();
    }else if(rise>.1){
      ctx.globalAlpha=rise;
      for(const side of [-1,1]){const x=a.x+side*r*1.5,y=a.y-r*.2;ctx.beginPath();ctx.moveTo(x,y-r*.55);ctx.lineTo(x+r*.12,y);ctx.lineTo(x,y+r*.55);ctx.lineTo(x-r*.12,y);ctx.closePath();ctx.fillStyle='#fff';ctx.fill();ctx.lineWidth=1.3;ctx.stroke();}
    }
    ctx.globalAlpha=1;
  }};
}
