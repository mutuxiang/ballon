import {Vector3} from 'three';
export function createMangaMotion(camera){
  const canvas=document.createElement('canvas');canvas.className='manga-motion';canvas.setAttribute('aria-hidden','true');Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'4'});document.body.append(canvas);
  const style=document.createElement('style');style.textContent='.super-mode body{background:transparent}';document.head.append(style);
  const ctx=canvas.getContext('2d');let time=0,previous=null,rise=0;
  const project=p=>{const v=p.clone().project(camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};};
  return {canvas,update(dt,sim){
    if(dt<=0)return;time+=dt;const head=sim.nodes[24].p,vy=previous===null?0:(head.y-previous)/dt;previous=head.y;
    rise+=((vy>.18?1:0)-rise)*Math.min(1,dt*7);
    const dpr=Math.min(devicePixelRatio,2);if(canvas.width!==Math.round(innerWidth*dpr)||canvas.height!==Math.round(innerHeight*dpr)){canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,innerWidth,innerHeight);
    const a=project(head),r=Math.max(18,Math.abs(project(head.clone().add(new Vector3(.8,0,0))).x-a.x));
    ctx.strokeStyle='#202421';ctx.lineCap='round';
    ctx.globalAlpha=1;
  }};
}
