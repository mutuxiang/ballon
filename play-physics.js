export function createObstacle({x,y,vx=0,vy=55,r=25,...rest}){return {x,y,vx,vy,r,angle:0,spin:0,hit:false,...rest};}
// Equal-mass circle contacts. A deflected object stays physical and dangerous.
export function resolvePair(a,b){
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),overlap=a.r+b.r-d;
 if(overlap<=0)return false;
 const nx=d>1e-6?dx/d:1,ny=d>1e-6?dy/d:0;
 a.x-=nx*overlap*.5;a.y-=ny*overlap*.5;b.x+=nx*overlap*.5;b.y+=ny*overlap*.5;
 const closing=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
 if(closing<0){const impulse=-closing*.82;a.vx-=nx*impulse;a.vy-=ny*impulse;b.vx+=nx*impulse;b.vy+=ny*impulse;a.spin-=ny*impulse*.015;b.spin+=ny*impulse*.015;}
 return true;
}
export function collideBumper(body,bumper){
 // The visible mouse circle is the only kinematic collider.
 const dx=body.x-bumper.x,dy=body.y-bumper.y;
 const d=Math.hypot(dx,dy),overlap=body.r+bumper.r-d;if(overlap<=0)return false;
 const nx=d>1e-6?dx/d:0,ny=d>1e-6?dy/d:-1;
 body.x+=nx*(overlap+.1);body.y+=ny*(overlap+.1);
 const relative=(body.vx-bumper.vx)*nx+(body.vy-bumper.vy)*ny;
 if(relative<0){const impulse=-relative*1.32+35;body.vx+=nx*impulse;body.vy+=ny*impulse;body.spin+=(bumper.vx*ny-bumper.vy*nx)*.007;}
 const speed=Math.hypot(body.vx,body.vy);if(speed>1100){body.vx*=1100/speed;body.vy*=1100/speed;}
 return true;
}
export function touchesCharacter(body,circles){return circles.some(c=>Math.hypot(body.x-c.x,body.y-c.y)<body.r+c.r);}
export function advanceObstacles(objects,bumper,dt,onHit){
 for(const o of objects){o.vy+=28*dt;o.vx*=Math.exp(-.07*dt);o.x+=o.vx*dt;o.y+=o.vy*dt;o.angle+=o.spin*dt;}
 for(let pass=0;pass<2;pass++){
  for(let i=0;i<objects.length;i++)for(let j=i+1;j<objects.length;j++)resolvePair(objects[i],objects[j]);
  for(const o of objects)if(collideBumper(o,bumper)&&!o.hit){o.hit=true;onHit(o);}
 }
}
