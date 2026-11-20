import * as THREE from 'three';

// Vector artwork rasterized at runtime: no remote images, fonts or loading race.
// Eight expressions based on the uploaded references.
export const SKINS = [
  {id:'chill', name:'淡定摸鱼', eyes:'sleepy', mouth:'line', note:'半睁眼 · 一切尽在掌握'},
  {id:'pout', name:'嘟嘴营业', eyes:'sleepy', mouth:'pout', note:'半睁眼 · 嘟起小嘴'},
  {id:'smile', name:'微笑营业', eyes:'sleepy', mouth:'smile', note:'半睁眼 · 嘴角上扬'},
  {id:'sparkle', name:'星星眼', eyes:'sparkle', mouth:'line', note:'闪亮双眼 · 期待下班'},
  {id:'sparkle-grin', name:'闪亮露齿', eyes:'sparkle', mouth:'grin', note:'闪亮双眼 · 开心露齿'},
  {id:'sleepy-grin', name:'勉强露齿', eyes:'sleepy', mouth:'grin', note:'半睁眼 · 礼貌露齿'},
  {id:'confident', name:'自信微笑', eyes:'confident', mouth:'confident', note:'弯眉黑眼 · 从容微笑'},
  {id:'narrow', name:'淡定直视', eyes:'narrow', mouth:'narrow-line', note:'窄椭圆眼 · 居中瞳孔 · 平嘴'}
];
const INK='#343532', PAPER='#fffdf5', PINK='#fa97a8';
// The existing straight mouth is the single stroke-width reference.
export const FACE_STROKE=7;
const ORIGINAL_STROKE=.049;

export function drawFace(ctx, skin, {skinColor='#ffc9ae',noseColor=PINK}={}) {
  ctx.clearRect(0,0,512,576);
  ctx.save();
  ctx.strokeStyle=INK;ctx.fillStyle=INK;
  ctx.lineCap='round';ctx.lineJoin='round';
  const path=(draw,fill=null,outline=true)=>{
    ctx.beginPath();draw();
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    // White eye highlights and teeth are filled shapes, not outlined strokes.
    if(outline&&fill!==PAPER){
      ctx.save();
      // Build the path in reference coordinates, then stroke in texture pixels.
      // This prevents the tilt correction from thickening some directions.
      ctx.setTransform(1,0,0,1,0,0);ctx.lineWidth=FACE_STROKE*2.65;
      ctx.stroke();ctx.restore();
    }
  };
  const oval=(x,y,rx,ry,fill)=>{ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();};
  // Trace in reference-image coordinates. Remove the photographed head's tilt
  // once, before wrapping onto the cylinder; all shared landmarks stay aligned.
  ctx.transform(2.65,.38425,0,2.65,256-306*2.65,190-207*2.65-306*.38425);
  if(skin.eyes==='confident') {
    path(()=>{ctx.moveTo(250,177);ctx.bezierCurveTo(263,168,278,171,288,184);},null);
    path(()=>{ctx.moveTo(322,170);ctx.quadraticCurveTo(337,158,350,165);},null);
    path(()=>{ctx.moveTo(252,202);ctx.lineTo(281,201);ctx.bezierCurveTo(289,229,256,240,252,213);ctx.closePath();},INK);
    path(()=>{ctx.moveTo(329,191);ctx.lineTo(356,188);ctx.bezierCurveTo(367,218,332,229,330,206);ctx.closePath();},INK);
    path(()=>{ctx.moveTo(282,177);ctx.bezierCurveTo(302,193,310,230,305,259);ctx.quadraticCurveTo(315,253,322,252);},null);
  } else {
    if(skin.eyes==='narrow'){
      path(()=>{ctx.moveTo(222,200);ctx.bezierCurveTo(238,172,273,152,300,172);ctx.bezierCurveTo(315,148,354,150,381,173);},null);
    }else{
      path(()=>{ctx.moveTo(222,208);ctx.bezierCurveTo(238,180,273,162,302,181);ctx.bezierCurveTo(315,157,358,157,383,181);},null);
    }
    if(skin.eyes==='narrow'){
      // Narrow horizontal openings without a lid bridge. The same centered
      // pupil is clipped symmetrically into each eye, leaving white crescents.
      for(const shift of [0,73]){
        ctx.save();ctx.transform(1,-.145,0,1,271+shift,213-shift*.145);
        const opening=()=>ctx.ellipse(0,0,20,8.5,0,0,Math.PI*2);
        path(opening,PAPER);
        ctx.save();ctx.clip();oval(0,0,11.5,9.5,INK);ctx.restore();
        path(opening);
        ctx.restore();
      }
    }else if(skin.eyes==='sleepy'){
      // Skin-filled upper lids and centered pupils inside a shared white eye.
      // The final stroke crosses BOTH eyes and the bridge without a gap.
      for(const shift of [0,70]){
        ctx.save();ctx.translate(shift,-shift*.145);
        path(()=>{ctx.moveTo(248,214);ctx.bezierCurveTo(246,194,273,192,286,201);ctx.bezierCurveTo(301,214,293,229,274,231);ctx.bezierCurveTo(255,234,247,228,248,214);ctx.closePath();},skinColor);
        path(()=>{ctx.moveTo(249,215);ctx.lineTo(292,209);ctx.bezierCurveTo(294,222,287,230,273,231);ctx.bezierCurveTo(257,234,249,229,249,215);ctx.closePath();},INK,false);
        // Draw one white opening, then clip a centered pupil into it. Separate
        // hand-drawn white wedges made the old pupils look shifted sideways.
        path(()=>{ctx.moveTo(254,214);ctx.lineTo(288,209);ctx.bezierCurveTo(289,220,281,227,271,228);ctx.bezierCurveTo(261,230,255,225,254,214);ctx.closePath();},PAPER);
        ctx.save();ctx.clip();
        ctx.transform(1,-.145,0,1,271,214);
        oval(0,0,10.5,14.5,INK);
        ctx.restore();
        ctx.restore();
      }
      path(()=>{ctx.moveTo(249,215);ctx.bezierCurveTo(283,210,329,203,368,198);},null);
    }else{
      for(const shift of [0,70]){
        ctx.save();ctx.translate(shift,-shift*.145);
        path(()=>{ctx.moveTo(250,215);ctx.bezierCurveTo(247,202,260,196,272,197);ctx.bezierCurveTo(288,197,295,207,291,218);ctx.bezierCurveTo(289,229,273,231,260,228);ctx.quadraticCurveTo(252,227,250,215);ctx.closePath();},INK);
        path(()=>{ctx.moveTo(253,211);ctx.bezierCurveTo(254,202,267,197,270,203);ctx.bezierCurveTo(273,210,261,216,255,216);ctx.closePath();},PAPER);
        path(()=>{ctx.moveTo(276,201);ctx.bezierCurveTo(284,203,290,210,288,214);ctx.bezierCurveTo(281,213,275,207,276,201);},PAPER);
        path(()=>{ctx.moveTo(263,225);ctx.quadraticCurveTo(270,211,275,216);ctx.lineTo(281,224);ctx.quadraticCurveTo(274,228,263,225);},PAPER);
        ctx.restore();
      }
    }
    path(()=>{ctx.moveTo(308,225);ctx.lineTo(300,257);ctx.quadraticCurveTo(308,261,317,257);ctx.closePath();},noseColor);
  }
  switch(skin.mouth){
    case 'narrow-line':path(()=>{ctx.moveTo(218,293);ctx.bezierCurveTo(252,292,309,288,330,281);},null);break;
    case 'line':path(()=>{ctx.moveTo(218,302);ctx.bezierCurveTo(252,301,309,298,329,290);},null);break;
    case 'pout':path(()=>{ctx.moveTo(282,286);ctx.bezierCurveTo(244,284,233,309,277,309);ctx.bezierCurveTo(242,313,239,338,289,329);},null);break;
    case 'smile':path(()=>{ctx.moveTo(218,302);ctx.quadraticCurveTo(277,302,330,289);ctx.bezierCurveTo(317,323,253,331,218,302);ctx.closePath();},PINK);break;
    case 'grin':
      path(()=>{ctx.moveTo(222,286);ctx.lineTo(353,275);ctx.bezierCurveTo(354,294,346,306,336,307);ctx.lineTo(225,317);ctx.quadraticCurveTo(217,305,222,286);ctx.closePath();},INK);
      for(let i=0;i<3;i++){
        const x=238+i*25,y=286-i*2;
        path(()=>{ctx.moveTo(x,y);ctx.lineTo(x+20,y-2);ctx.lineTo(x+20,y+13);ctx.lineTo(x+2,y+15);ctx.closePath();},PAPER);
        path(()=>{ctx.moveTo(x+3,y+21);ctx.lineTo(x+21,y+19);ctx.lineTo(x+21,y+25);ctx.lineTo(x+4,y+27);ctx.closePath();},PAPER);
      }break;
    case 'confident':path(()=>{ctx.moveTo(279,289);ctx.bezierCurveTo(303,303,331,300,358,275);},null);break;
  }
  ctx.restore();
}

export function createSkins(character) {
  let palette={skinColor:'#ffc9ae',noseColor:PINK};
  let surfaceGradient=false;
  const textures=SKINS.map(skin=>{
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=576;
    drawFace(canvas.getContext('2d'),skin);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=4;return texture;
  });
  // A subdivided cylindrical print uses the same rest coordinates as the body.
  // AirPhysics deforms every vertex, so the face stays attached during collapse.
  const positions=[],uv=[],indices=[],cols=36,rows=40;
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
    const u=col/cols,v=row/rows,x=(u-.5)*1.18,y=4.04+v*1.27;
    const originalY=.64+(y-.64)/(4.9/7.6),radius=.66-.025*((originalY-.64)/7.6);
    positions.push(x,y,Math.sqrt(Math.max(.01,radius*radius-x*x))+.018);uv.push(u,v);
  }
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const a=row*(cols+1)+col,b=a+cols+1;indices.push(a,a+1,b,b,a+1,b+1);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
  const material=new THREE.MeshBasicMaterial({map:textures[0],transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  material.userData.outlineParameters={visible:false};
  const mesh=new THREE.Mesh(geo,material);mesh.name='Expression_print';mesh.frustumCulled=false;mesh.renderOrder=2;character.add(mesh);
  const focusTexture=new THREE.TextureLoader().load('./focus-expression-ink-v3.png');focusTexture.colorSpace=THREE.SRGBColorSpace;focusTexture.anisotropy=4;focusTexture.repeat.set(.85,.65);focusTexture.offset.set(.075,.19);
  let focused=false;
  let active=SKINS[0].id;
  function redraw(){
    // Let the real skin underneath supply the gradient through eyelids/nose;
    // keep ink, eye whites and mouth details crisp rather than tinting them.
    const colors=surfaceGradient?{skinColor:null,noseColor:null}:palette;
    textures.forEach((texture,index)=>{drawFace(texture.image.getContext('2d'),SKINS[index],colors);texture.needsUpdate=true;});
  }
  return {
    dispose(){textures.forEach(texture=>texture.dispose());focusTexture.dispose();},
    get active(){return active;},
    setFocus(value){if(focused===Boolean(value))return;focused=Boolean(value);this.select(active);},
    setPalette(next){
      if(next.skinColor===palette.skinColor&&next.noseColor===palette.noseColor)return;
      palette={...next};
      redraw();
    },
    setSurfaceGradient(value){const next=Boolean(value);if(next===surfaceGradient)return;surfaceGradient=next;redraw();},
    select(id){const index=SKINS.findIndex(s=>s.id===id);if(index<0)return false;material.map=focused?focusTexture:textures[index];mesh.visible=true;for(const name of ['Original_face_ink','Original_face_white'])character.getObjectByName(name).visible=false;active=id;character.userData.skin=id;return true;},
    thumbnail(index){return textures[index].image.toDataURL('image/png');}
  };
}
