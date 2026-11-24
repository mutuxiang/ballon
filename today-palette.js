export const APPEARANCE_KEY='air-worker-today-appearance-v1';
export const COLOR_KEYS=['skin','hair','outer','inner','trousers'];
// A user-selected illustrated default, never inferred from a person's ethnicity.
export const DEFAULT_SKIN='#f3ceb0';
export function localDay(date=new Date()){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function normalizeAppearance(value){
  if(!value||![1,2].includes(value.version)||!/^\d{4}-\d{2}-\d{2}$/.test(value.day)||!value.colors)return null;
  const source=value.version===1?{...value.colors,outer:value.colors.shirt,inner:value.colors.shirt}:value.colors,colors={};
  for(const key of COLOR_KEYS){
    if(typeof source[key]!=='string'||!/^#[\da-f]{6}$/i.test(source[key]))return null;
    colors[key]=source[key].toLowerCase();
  }
  return {version:2,day:value.day,colors};
}
const hex=rgb=>'#'+rgb.map(c=>Math.max(0,Math.min(255,Math.round(c))).toString(16).padStart(2,'0')).join('');
export function rgbToHsl(rgb){
  const [r,g,b]=rgb.map(c=>c/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
  if(d<1e-8)return [0,0,l];
  const h=(max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)/6;
  return [h,d/(1-Math.abs(2*l-1)),l];
}
function fromHsl([h,s,l]){
  const a=s*Math.min(l,1-l),f=n=>{const k=(n+h*12)%12;return 255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)));};
  return [f(0),f(8),f(4)];
}
function tone(rgb,lift){const [h,s,l]=rgbToHsl(rgb);return fromHsl([h,s,lift>=0?l+(1-l)*lift:l*(1+lift)]);}
export function recognizedColorVariants(value){
  if(!/^#[\da-f]{6}$/i.test(value))throw new Error('无效的识别颜色');
  const rgb=[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)),seen=new Set();
  return [[-.30,'深一些'],[-.18,'稍深'],[-.08,'微深'],[0,'识别原色'],[.10,'微浅'],[.22,'稍浅'],[.36,'浅一些']].flatMap(([lift,name])=>{
    const color=(lift===0?value:hex(tone(rgb,lift))).toUpperCase();
    // Retain the original marker even when a near-black shade rounds to it.
    if(lift!==0&&color===value.toUpperCase())return [];
    if(seen.has(color))return [];seen.add(color);return [[name,color]];
  });
}
// Keep a real representative pixel from the dominant hue family. Avoid mixing
// channels from different garments or averaging the jacket with the inner layer.
export function samplePhotoColors({data,width,height}){
  if(!width||!height||data.length<width*height*4)throw new Error('照片像素不完整');
  function sample(regions){
    let pixels=[];
    for(const [x0,y0,x1,y1] of regions)for(let y=Math.floor(y0*height);y<Math.ceil(y1*height);y++)for(let x=Math.floor(x0*width);x<Math.ceil(x1*width);x++){
      const i=(y*width+x)*4;if(data[i+3]>=128)pixels.push([data[i],data[i+1],data[i+2]]);
    }
    if(!pixels.length)throw new Error('照片没有可用的颜色');
    const groups=new Map();
    for(const rgb of pixels){const [h,s,l]=rgbToHsl(rgb);const key=s<.12?'neutral-'+Math.min(2,Math.floor(l*3)):'hue-'+Math.round(h*24)%24;const group=groups.get(key)||[];group.push(rgb);groups.set(key,group);}
    const dominant=[...groups.values()].sort((a,b)=>b.length-a.length)[0];
    dominant.sort((a,b)=>rgbToHsl(a)[2]-rgbToHsl(b)[2]);
    return dominant[Math.min(dominant.length-1,Math.floor(dominant.length*.55))];
  }
  const hair=sample([[.39,.12,.61,.22]]);
  const outer=sample([[.28,.64,.43,.86],[.57,.64,.72,.86]]),inner=sample([[.455,.64,.545,.84]]);
  // Only lightness changes; hue and saturation stay fixed. Dark/neutral clothes
  // remain in their original family instead of being turned pastel by white.
  return {skin:DEFAULT_SKIN,hair:hex(tone(hair,.025)),outer:hex(tone(outer,.06)),inner:hex(tone(inner,.06)),trousers:hex(tone(outer,-.28))};
}
