// Local, deterministic feature estimation. No source-photo pixels are used in
// the finished artwork; only the small, editable feature description survives.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0));
const hex=rgb=>'#'+rgb.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const luma=c=>c[0]*.299+c[1]*.587+c[2]*.114;
export function analyzePortrait({data,width,height}) {
  if(!width||!height||data.length!==width*height*4)throw Error('照片数据不完整，请重新拍摄。');
  const pixels=(box,predicate=()=>true)=>{
    const result=[];
    for(let y=Math.floor(box[1]*height);y<box[3]*height;y+=2)for(let x=Math.floor(box[0]*width);x<box[2]*width;x+=2){
      const i=(y*width+x)*4,c=[data[i],data[i+1],data[i+2]];
      if(data[i+3]>200&&predicate(c))result.push(c);
    }
    return result;
  };
  function dominant(values,fallback){
    if(!values.length)return fallback;
    const bins=new Map();
    for(const c of values){const k=c.map(v=>v>>5).join(',');const bin=bins.get(k)||[];bin.push(c);bins.set(k,bin);}
    const best=[...bins.values()].sort((a,b)=>b.length-a.length)[0];
    return hex([0,1,2].map(i=>best.reduce((s,c)=>s+c[i],0)/best.length));
  }
  const isSkin=([r,g,b])=>{
    const cb=128-.168736*r-.331264*g+.5*b,cr=128+.5*r-.418688*g-.081312*b;
    return cr>132&&cr<180&&cb>75&&cb<132&&r>g*.93&&r>b*1.06&&r>35;
  };
  const skinPixels=pixels([.32,.15,.68,.46],isSkin);
  const skin=dominant(skinPixels,'#e8b597');
  const skinRgb=rgb(skin);
  const hairCandidates=pixels([.24,.035,.76,.19],c=>!isSkin(c)&&luma(c)<210);
  const hair=dominant(hairCandidates,'#343532');
  const hairRgb=rgb(hair);
  const nearHair=c=>distance(c,hairRgb)<65&&!isSkin(c);
  const left=pixels([.16,.24,.3,.59]);
  const right=pixels([.7,.24,.84,.59]);
  const sideHair=[...left,...right];
  const longRatio=sideHair.filter(nearHair).length/Math.max(1,sideHair.length);
  const forehead=pixels([.38,.17,.62,.24]);
  const fringeRatio=forehead.filter(nearHair).length/Math.max(1,forehead.length);
  let hairstyle=hairCandidates.length<8?'cropped':longRatio>.36?'long':fringeRatio>.65?'fringe':'parted';
  const shirt=dominant(pixels([.18,.69,.82,.94],c=>!isSkin(c)),'#567984');
  const inner=dominant(pixels([.43,.59,.57,.87],c=>!isSkin(c)),shirt);
  const side=dominant([...pixels([.2,.64,.34,.93]),...pixels([.66,.64,.8,.93])],shirt);
  const outfit=distance(rgb(inner),rgb(side))>55?'jacket':'tee';
  const mouth=pixels([.39,.365,.61,.455]);
  const teeth=mouth.filter(c=>Math.min(...c)>185&&Math.max(...c)-Math.min(...c)<45).length;
  const dark=mouth.filter(c=>luma(c)<luma(skinRgb)*.57).length;
  const expression=teeth>mouth.length*.07?'grin':dark>mouth.length*.12?'smile':'calm';
  return {skin,hair,shirt:outfit==='jacket'?side:shirt,inner,hairstyle,outfit,expression,glasses:false,
    confidence:clamp(skinPixels.length/(width*height*.012),0,1)};
}
