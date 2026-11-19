export const HAZARDS=['邮件','绩效','截止','会议','加班','催办'];

// Measure the silhouette inside each atlas cell; transparent padding must not
// determine an item's on-screen size. Source PNGs remain untouched.
export function spriteBounds(pixels,imageWidth,x,y,width,height){
  let left=x+width,top=y+height,right=-1,bottom=-1;
  for(let py=y;py<y+height;py++)for(let px=x;px<x+width;px++){
    if(pixels[(py*imageWidth+px)*4+3]<32)continue;
    left=Math.min(left,px);top=Math.min(top,py);right=Math.max(right,px);bottom=Math.max(bottom,py);
  }
  return right<0?null:{x:left,y:top,width:right-left+1,height:bottom-top+1};
}

export function spriteSize(bounds,size){
  const factor=size/Math.max(bounds.width,bounds.height);
  return {width:bounds.width*factor,height:bounds.height*factor};
}

export function loadAtlas(src,columns,rows,onReady=()=>{}){
  const image=new Image(),cells=[];
  const atlas={image,cells,ready:false,
    draw(ctx,index,x,y,size){
      const cell=cells[index];if(!this.ready||!cell)return false;
      const fit=spriteSize(cell,size);
      ctx.drawImage(image,cell.x,cell.y,cell.width,cell.height,x-fit.width/2,y-fit.height/2,fit.width,fit.height);
      return true;
    }
  };
  image.onload=()=>{
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const x=Math.floor(col*canvas.width/columns),y=Math.floor(row*canvas.height/rows);
      cells.push(spriteBounds(pixels,canvas.width,x,y,Math.floor((col+1)*canvas.width/columns)-x,Math.floor((row+1)*canvas.height/rows)-y));
    }
    atlas.ready=true;onReady();
  };
  image.src=src;return atlas;
}
