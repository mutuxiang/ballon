import * as T from 'three';

// Coordinates refer to the alpha-cropped source artwork, not its atlas cell.
// Only the open U-shaped vessel is solid. Glass, fish, liquid and the opening
// are intentionally excluded. Cup handles must not widen the interior.
export const VESSELS={
  bowl:{opening:[.17,.83,.105],bottom:.955,bodyRight:1,inset:.025,
    outline:[[.17,.105],[.095,.24],[.035,.4],[.03,.56],[.065,.72],[.15,.86],[.29,.94],[.5,.955],[.71,.94],[.85,.86],[.935,.72],[.97,.56],[.965,.4],[.905,.24],[.83,.105]]},
  cup:{opening:[.055,.775,.18],bottom:.95,bodyRight:.79,inset:.02,
    outline:[[.055,.18],[.06,.38],[.08,.58],[.12,.78],[.21,.91],[.4,.95],[.59,.91],[.69,.78],[.735,.58],[.765,.38],[.775,.18]]}
};

// Sample persistent opaque runs on each row. Glass may have a transparent
// center, so requiring a filled scanline would incorrectly reject its contour.
export function extractVesselOutline(pixels,imageWidth,bounds,kind){
  const spec=VESSELS[kind],center=(spec.opening[0]+spec.opening[1])/2,left=[],right=[];
  const samples=9,limit=Math.floor(bounds.width*spec.bodyRight);
  for(let row=0;row<samples;row++){
    const v=T.MathUtils.lerp(spec.opening[2]+.09,spec.bottom-.025,row/(samples-1));
    const y=bounds.y+Math.min(bounds.height-1,Math.round(v*bounds.height));
    const opaque=x=>pixels[(y*imageWidth+bounds.x+x)*4+3]>=80;
    const minimumRun=Math.max(2,Math.round(bounds.width*.006));let a=limit,b=-1,start=-1;
    for(let x=0;x<=limit;x++){
      if(x<limit&&opaque(x)){if(start<0)start=x;}
      else if(start>=0){if(x-start>=minimumRun){a=Math.min(a,start);b=x-1;}start=-1;}
    }
    if(b-a<bounds.width*.18)return spec.outline.map(p=>[...p]);
    left.push([a/bounds.width+spec.inset,v]);right.push([b/bounds.width-spec.inset,v]);
  }
  return [[spec.opening[0],spec.opening[2]],...left,[center,spec.bottom],...right.reverse(),[spec.opening[1],spec.opening[2]]];
}

function closest(x,y,s){const t=T.MathUtils.clamp(((x-s.ax)*s.dx+(y-s.ay)*s.dy)/s.lengthSq,0,1);return {x:s.ax+t*s.dx,y:s.ay+t*s.dy};}

// Exact circle/segment distances and swept-circle contacts act as a small
// analytic distance field. No per-frame canvas readback or image resampling.
export class OutlineCollider {
  constructor(points,width,height,thickness=.025){
    this.width=width;this.height=height;this.radius=thickness*Math.min(width,height)/2;
    this.points=points.map(([u,v])=>({x:(u-.5)*width,y:(.5-v)*height}));
    this.segments=this.points.slice(1).map((b,i)=>{const a=this.points[i],dx=b.x-a.x,dy=b.y-a.y,lengthSq=dx*dx+dy*dy,length=Math.sqrt(lengthSq);
      return {ax:a.x,ay:a.y,bx:b.x,by:b.y,dx,dy,lengthSq,nx:-dy/length,ny:dx/length,minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minY:Math.min(a.y,b.y),maxY:Math.max(a.y,b.y)};});
  }
  distance(point){let min=Infinity;for(const s of this.segments){const q=closest(point.x,point.y,s);min=Math.min(min,Math.hypot(point.x-q.x,point.y-q.y)-this.radius);}return min;}
  separate(point,radius){
    let x=point.x,y=point.y,nx=0,ny=0,hit=false;const r=radius+this.radius;
    for(let pass=0;pass<3;pass++)for(const s of this.segments){
      if(x<s.minX-r||x>s.maxX+r||y<s.minY-r||y>s.maxY+r)continue;
      const q=closest(x,y,s),dx=x-q.x,dy=y-q.y,d=Math.hypot(dx,dy);
      if(d>=r-1e-7)continue;
      nx=d>1e-8?dx/d:s.nx;ny=d>1e-8?dy/d:s.ny;x+=nx*(r-d+1e-5);y+=ny*(r-d+1e-5);hit=true;
    }
    return {x,y,nx,ny,hit};
  }
  cast(from,to,radius){
    const dx=to.x-from.x,dy=to.y-from.y,r=radius+this.radius,speedSq=dx*dx+dy*dy;let best=null;
    if(speedSq<1e-14)return null;
    const consider=(t,nx,ny)=>{if(t>=-1e-7&&t<=1&&(!best||t<best.t)&&dx*nx+dy*ny< -1e-9)best={t:Math.max(0,t),nx,ny};};
    for(const s of this.segments){
      if(Math.max(from.x,to.x)<s.minX-r||Math.min(from.x,to.x)>s.maxX+r||Math.max(from.y,to.y)<s.minY-r||Math.min(from.y,to.y)>s.maxY+r)continue;
      for(const side of [-1,1]){
        const nx=s.nx*side,ny=s.ny*side,v=dx*nx+dy*ny;
        if(v>=-1e-9)continue;
        const d=(from.x-s.ax)*nx+(from.y-s.ay)*ny,t=(r-d)/v;
        const along=((from.x+t*dx-s.ax)*s.dx+(from.y+t*dy-s.ay)*s.dy)/s.lengthSq;
        if(along>=0&&along<=1)consider(t,nx,ny);
      }
      for(const [cx,cy] of [[s.ax,s.ay],[s.bx,s.by]]){
        const ox=from.x-cx,oy=from.y-cy,b=ox*dx+oy*dy,c=ox*ox+oy*oy-r*r,disc=b*b-speedSq*c;
        if(disc<0)continue;const t=(-b-Math.sqrt(disc))/speedSq;
        consider(t,(ox+dx*t)/r,(oy+dy*t)/r);
      }
    }
    return best;
  }
  move(from,to,radius){
    let p=this.separate(from,radius),target={x:to.x+(p.x-from.x),y:to.y+(p.y-from.y)},hit=p.hit,nx=p.nx,ny=p.ny;
    for(let i=0;i<4;i++){
      const contact=this.cast(p,target,radius);if(!contact){p=target;break;}
      hit=true;nx=contact.nx;ny=contact.ny;
      const dx=target.x-p.x,dy=target.y-p.y;
      p={x:p.x+dx*contact.t+nx*1e-5,y:p.y+dy*contact.t+ny*1e-5};
      const rx=dx*(1-contact.t),ry=dy*(1-contact.t),into=Math.min(0,rx*nx+ry*ny);
      target={x:p.x+rx-into*nx,y:p.y+ry-into*ny};
    }
    const end=this.separate(p,radius);if(end.hit){hit=true;nx=end.nx;ny=end.ny;}return {...end,hit,nx,ny};
  }
  // When a theme is selected around an already fallen character, place the
  // submerged sections inside the vessel once. Afterwards contacts are two-sided
  // and a body leaning over the lip can rest on its exterior normally.
  seat(point,radius){
    const first=this.points[0],last=this.points.at(-1),top=Math.min(first.y,last.y);
    if(point.y>=top)return point;
    const floor=Math.min(...this.points.map(p=>p.y))+radius+this.radius;
    const y=Math.max(point.y,floor),xs=[];
    for(const s of this.segments)if(y>=s.minY&&y<=s.maxY&&Math.abs(s.dy)>1e-8)xs.push(s.ax+(y-s.ay)/s.dy*s.dx);
    if(xs.length<2)return {x:(first.x+last.x)/2,y};
    const lo=Math.min(...xs)+radius+this.radius,hi=Math.max(...xs)-radius-this.radius;
    return {x:lo<=hi?T.MathUtils.clamp(point.x,lo,hi):(lo+hi)/2,y};
  }
}

// Map character-local positions into the billboard's image plane. Perspective
// scale, camera orbit, viewport aspect and character transforms all participate.
export class SpriteProjection {
  constructor(character,camera,center){
    this.character=character;this.camera=camera;
    character.updateWorldMatrix(true,false);camera.updateWorldMatrix(true,false);
    this.center=center.clone().applyMatrix4(camera.matrixWorldInverse);
    this.toView=new T.Matrix4().multiplyMatrices(camera.matrixWorldInverse,character.matrixWorld);this.fromView=this.toView.clone().invert();
    const scale=character.getWorldScale(new T.Vector3());this.scale=Math.max(scale.x,scale.y,scale.z);
  }
  project(p){const v=p.clone().applyMatrix4(this.toView),factor=this.camera.isPerspectiveCamera?this.center.z/Math.min(-.01,v.z):1;return {x:v.x*factor-this.center.x,y:v.y*factor-this.center.y,z:v.z,factor};}
  unproject(p,depth){const factor=this.camera.isPerspectiveCamera?depth/this.center.z:1;return new T.Vector3((p.x+this.center.x)*factor,(p.y+this.center.y)*factor,depth).applyMatrix4(this.fromView);}
}

export class SpriteVesselPhysics {
  constructor(character,camera,getContainer){this.character=character;this.camera=camera;this.getContainer=getContainer;this.previous=new WeakMap();this.contacts=0;this.active=false;this.needsSeat=true;}
  reset(){this.previous=new WeakMap();this.contacts=0;this.needsSeat=true;}
  step(simulation){
    const container=this.getContainer();if(!container)return;
    const {center,collider}=container,map=new SpriteProjection(this.character,this.camera,center);if(map.center.z>=-.1)return;
    const nodes=[...simulation.nodes.slice(2).map(n=>({n,r:simulation.bodyRadius(n)})),...simulation.arms.flatMap(arm=>arm.nodes.slice(1).map(n=>({n,r:.12+.12*n.pressure})))];
    const accepted=new Map();
    for(const {n,r} of nodes){
      if(this.needsSeat){const p=map.project(n.p),seated=collider.seat(p,r*map.scale*p.factor);const correction=map.unproject(seated,p.z).sub(n.p);n.p.add(correction);n.old.add(correction);}
      accepted.set(n,(this.previous.get(n)||n.p).clone());
    }
    this.needsSeat=false;
    for(let pass=0;pass<8;pass++){
      for(let i=2;i<simulation.nodes.length;i++)simulation.solveDistance(simulation.nodes[i-1],simulation.nodes[i],4.9/24,1,i===2);
      for(const arm of simulation.arms){
        arm.nodes[0].p.copy(simulation.bodyPosition(arm.sign*.5,3.677,0));
        for(let i=1;i<arm.nodes.length;i++)simulation.solveDistance(arm.nodes[i-1],arm.nodes[i],1.04/6,1,i===1);
      }
      for(const {n,r} of nodes){
        const from=map.project(accepted.get(n)),to=map.project(n.p),radius=r*map.scale*to.factor;
        const result=collider.move(from,to,radius);
        if(result.hit){
          const old=map.project(n.old),vx=to.x-old.x,vy=to.y-old.y,into=Math.min(0,vx*result.nx+vy*result.ny);
          n.p.copy(map.unproject(result,to.z));
          n.old.copy(map.unproject({x:result.x-(vx-into*result.nx*1.04)*.97,y:result.y-(vy-into*result.ny*1.04)*.97},old.z));
          this.contacts++;
        }
        accepted.get(n).copy(n.p);
      }
    }
    for(const {n} of nodes)this.previous.set(n,n.p.clone());
  }
}
