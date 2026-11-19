import {Vector3} from 'three';
export function createMangaMotion(camera){
  const canvas=document.createElement('canvas');canvas.className='manga-motion';canvas.setAttribute('aria-hidden','true');Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'4'});document.body.append(canvas);
  const style=document.createElement('style');style.textContent='.super-mode body{background:transparent}';document.head.append(style);
  const ctx=canvas.getContext('2d');let time=0,wasFocused=false,burst=0;
  const project=p=>{const v=p.clone().project(camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};};
  return {canvas,get burst(){return burst;},update(dt,sim,ink='#202421'){
    if(dt<=0)return;time+=dt;const head=sim.nodes[24].p;
    if(sim.superMode&&!wasFocused){burst=1;const origin=project(head);window.desktopPet?.burst({x:origin.x,y:origin.y,ink});}
    if(!sim.superMode)burst=0;
    wasFocused=Boolean(sim.superMode);burst=Math.max(0,burst-dt/1.1);
    const dpr=Math.min(devicePixelRatio,2);if(canvas.width!==Math.round(innerWidth*dpr)||canvas.height!==Math.round(innerHeight*dpr)){canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,innerWidth,innerHeight);
    const a=project(head),r=Math.max(18,Math.abs(project(head.clone().add(new Vector3(.8,0,0))).x-a.x));
    ctx.strokeStyle=ink;ctx.lineCap='round';
    if(burst>0){
      const expansion=1-burst;
      ctx.globalAlpha=Math.min(1,burst*2);
      // A single short impact, not a repeating flash; keep the face clear.
      for(let i=0;i<36;i++){
        const angle=i/36*Math.PI*2,inner=r*(1.55+expansion*.9),outer=inner+r*(.65+(i%4)*.18)*burst;
        ctx.beginPath();ctx.moveTo(a.x+Math.cos(angle)*inner,a.y+Math.sin(angle)*inner);ctx.lineTo(a.x+Math.cos(angle)*outer,a.y+Math.sin(angle)*outer);ctx.lineWidth=i%4===0?2.5:1;ctx.stroke();
      }
      ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(a.x,a.y,(window.desktopPet?r*(1.4+expansion*1.6):r+expansion*Math.hypot(innerWidth,innerHeight)),(window.desktopPet?r*(1.15+expansion*1.4):r+expansion*Math.hypot(innerWidth,innerHeight)),0,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle=ink;
      for(let i=0;i<24;i++){const angle=i*2.399,rad=r*(1.8+(i%5)*.14+expansion*.5);ctx.beginPath();ctx.arc(a.x+Math.cos(angle)*rad,a.y+Math.sin(angle)*rad,.8+(i%3)*.3,0,Math.PI*2);ctx.fill();}
    }
    ctx.globalAlpha=1;
  }};
}
