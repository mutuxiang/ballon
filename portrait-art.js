// Reconstruct the portrait using the project's flat ink / ivory / color-block
// vocabulary. This is vector drawing, not a pixel filter or photo projection.
export const PORTRAIT_INK='#343532';
const PAPER='#fffdf5';
const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function painter(canvas){
  const c=canvas.getContext('2d');c.lineWidth=16;c.lineCap='round';c.lineJoin='round';c.strokeStyle=PORTRAIT_INK;
  const path=(d,fill=null,stroke=true)=>{c.beginPath();d(c);if(fill){c.fillStyle=fill;c.fill();}if(stroke)c.stroke();};
  const oval=(x,y,rx,ry,color,stroke=false)=>path(c=>c.ellipse(x,y,rx,ry,0,0,Math.PI*2),color,stroke);
  return {c,path,oval};
}
export function renderPortrait(f){
  const head=make(1024,768),shirt=make(1024,768),preview=make(360,480);
  const {c,path,oval}=painter(head);
  c.fillStyle=f.hair;c.fillRect(0,0,1024,768);
  // The middle half wraps across the forward half of the cylindrical head.
  c.save();c.translate(256,0);
  c.fillStyle=f.skin;c.fillRect(0,0,512,768);
  const long=f.hairstyle==='long',fringe=f.hairstyle==='fringe';
  if(f.hairstyle!=='cropped'){
    path(c=>{
      c.moveTo(-8,-8);c.lineTo(520,-8);c.lineTo(520,long?768:295);
      c.quadraticCurveTo(465,long?770:350,458,long?704:216);
      if(fringe){c.lineTo(436,214);c.lineTo(412,242);c.lineTo(385,208);c.lineTo(353,237);c.lineTo(323,205);c.lineTo(286,229);c.lineTo(252,208);c.lineTo(220,229);c.lineTo(187,205);c.lineTo(152,231);c.lineTo(120,207);c.lineTo(78,231);}
      else{c.bezierCurveTo(380,190,319,152,285,105);c.bezierCurveTo(236,178,160,202,61,226);}
      c.quadraticCurveTo(49,long?590:340,40,long?706:296);
      c.lineTo(-8,long?768:295);c.closePath();
    },f.hair);
    if(!fringe)path(c=>{c.moveTo(285,58);c.quadraticCurveTo(259,87,252,130);});
  }else{
    path(c=>{c.moveTo(-8,-8);c.lineTo(520,-8);c.lineTo(520,114);c.quadraticCurveTo(256,48,-8,114);c.closePath();},f.hair);
  }
  // Same broad eye whites, small round pupils and relaxed lids as the model.
  for(const x of [157,355]){
    oval(x,335,65,70,PAPER,true);oval(x+2,345,25,29,PORTRAIT_INK);
    path(c=>{c.moveTo(x-66,327);c.quadraticCurveTo(x,303,x+66,326);});
    path(c=>{c.moveTo(x-54,237);c.quadraticCurveTo(x,216,x+48,239);});
  }
  path(c=>{c.moveTo(269,402);c.quadraticCurveTo(238,438,244,468);c.quadraticCurveTo(250,484,275,477);});
  if(f.expression==='grin'){
    path(c=>{c.moveTo(157,572);c.lineTo(355,572);c.quadraticCurveTo(338,663,255,660);c.quadraticCurveTo(170,652,157,572);c.closePath();},PORTRAIT_INK);
    path(c=>{c.moveTo(168,580);c.lineTo(342,580);c.lineTo(333,612);c.lineTo(179,612);c.closePath();},PAPER,false);
  }else if(f.expression==='smile'){
    path(c=>{c.moveTo(169,593);c.quadraticCurveTo(256,663,345,580);});
  }else if(f.expression==='pout'){
    path(c=>{c.moveTo(281,569);c.bezierCurveTo(205,557,204,609,268,602);c.bezierCurveTo(213,605,221,645,286,631);});
  }else path(c=>{c.moveTo(171,602);c.quadraticCurveTo(254,615,342,594);});
  if(f.glasses){
    for(const x of [157,355])path(c=>c.roundRect(x-75,277,149,125,27));
    path(c=>{c.moveTo(232,314);c.quadraticCurveTo(255,303,280,314);});
  }
  c.restore();
  const s=painter(shirt);s.c.fillStyle=f.shirt;s.c.fillRect(0,0,1024,768);s.c.save();s.c.translate(256,0);
  if(f.outfit==='jacket'){
    s.path(c=>{c.moveTo(157,-8);c.lineTo(355,-8);c.lineTo(356,780);c.lineTo(156,780);c.closePath();},f.inner);
    s.path(c=>{c.moveTo(90,0);c.lineTo(172,0);c.lineTo(235,227);c.lineTo(149,317);c.lineTo(199,390);c.lineTo(143,768);});
    s.path(c=>{c.moveTo(422,0);c.lineTo(340,0);c.lineTo(277,227);c.lineTo(363,317);c.lineTo(313,390);c.lineTo(369,768);});
    s.path(c=>{c.moveTo(202,0);c.quadraticCurveTo(256,78,310,0);});
  }else if(f.outfit==='collar'){
    s.path(c=>{c.moveTo(81,0);c.lineTo(256,54);c.lineTo(171,191);c.closePath();},PAPER);
    s.path(c=>{c.moveTo(431,0);c.lineTo(256,54);c.lineTo(341,191);c.closePath();},PAPER);
    s.path(c=>{c.moveTo(256,75);c.lineTo(256,768);});
    for(const y of [270,460,650])s.oval(279,y,5,5,PORTRAIT_INK);
  }else{
    s.path(c=>{c.moveTo(140,-8);c.quadraticCurveTo(256,124,372,-8);},f.skin);
    s.path(c=>{c.moveTo(135,16);c.quadraticCurveTo(256,147,377,16);});
  }
  s.c.restore();
  const p=painter(preview);p.c.lineWidth=5;p.c.fillStyle='#edf0e8';p.c.fillRect(0,0,360,480);
  // Preview the actual head / garment UV artwork on the tube silhouette.
  p.c.save();p.c.beginPath();p.c.roundRect(105,25,150,425,[65,65,12,12]);p.c.clip();
  p.c.fillStyle=f.hair;p.c.fillRect(105,25,150,40);
  p.c.drawImage(head,256,0,512,768,105,53,150,187);
  p.c.drawImage(shirt,256,0,512,768,105,240,150,210);p.c.restore();
  p.path(c=>c.roundRect(105,25,150,425,[65,65,12,12]));
  return {head,shirt,preview,features:{...f}};
}
