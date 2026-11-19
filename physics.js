import * as T from 'three';
import {SHOULDER_Y} from './arm-mesh.js';
const UP=new T.Vector3(0,1,0),SIDE=new T.Vector3(1,0,0);
const clamp=T.MathUtils.clamp;
const DODGE_DURATION=.23;
const DEFLATION_RATE=1;
// Fixed-step position-based elastic rod. Pressure is transported upwards and
// attenuated by kinks; gravity, drag and correlated gusts drive the motion.
export class AirPhysics {
  constructor(root,{seed=28713,planar=false,depthMotion=1}={}){
    this.planar=planar;this.depthMotion=depthMotion;
    this.seed=seed;this.target=1;this.time=0;this.acc=0;this.wind=new T.Vector3();
    this.nodes=Array.from({length:25},(_,i)=>({p:new T.Vector3(.035*Math.sin(i*.3),.64+i*4.9/24,0),old:new T.Vector3(.035*Math.sin(i*.3),.64+i*4.9/24,0),pressure:1}));
    this.arms=[-1,1].map(sign=>({sign,nodes:Array.from({length:7},(_,i)=>({p:new T.Vector3(sign*(.5+i*1.04/6),3.677,0),old:new T.Vector3(sign*(.5+i*1.04/6),3.677,0),pressure:1}))}));
    this.meshes=[];root.traverse(o=>{if(o.isMesh&&(o.userData.deformWithBody||['Shirt','Skin','Hair','Trousers','Face_ink','White_details','Arm_left','Arm_right','Expression_print','Original_face_ink','Original_face_white'].includes(o.name))){this.meshes.push({mesh:o,rest:o.geometry.attributes.position.array.slice()});o.frustumCulled=false;}});
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  setState(s){const target={none:0,low:.72,high:1}[s];if(s==='low'&&target>this.target)this.lowBoost=1.6;this.target=target;}
  dodge(direction){
    if(!this.dodgeMotion)this.dodgeMotion={
      direction,start:this.time,pose:this.nodes.map(node=>node.p.clone())
    };
  }
  update(dt){this.acc+=Math.min(dt,.1);while(this.acc>=1/120){this.step(1/120);this.acc-=1/120;}this.deform();}
  solveDistance(a,b,length,strength=1,fixed=false){const d=b.p.clone().sub(a.p),len=d.length();if(len<1e-7)return;d.multiplyScalar((len-length)/len*strength);if(fixed)b.p.sub(d);else{a.p.addScaledVector(d,.5);b.p.addScaledVector(d,-.5);}}
  integrate(n,force,h){const v=n.p.clone().sub(n.old).multiplyScalar(.993);n.old.copy(n.p);n.p.add(v).addScaledVector(force,h*h);}
  bodyRadius(n){return .36+.31*n.pressure;}
  // Capsule contact, including the space between solver nodes.
  repelSegment(node,a,b,radius){
    const ab=b.p.clone().sub(a.p),t=clamp(node.p.clone().sub(a.p).dot(ab)/Math.max(ab.lengthSq(),1e-9),0,1);
    const closest=a.p.clone().addScaledVector(ab,t),d=node.p.clone().sub(closest),len=d.length();
    if(len>=radius)return;
    if(len<1e-8)d.set(1,0,0);else d.multiplyScalar(1/len);
    node.p.addScaledVector(d,radius-len);
  }
  step(h){
    this.time+=h;
    this.wind.x+=(this.random()-.5)*.35-this.wind.x*h*.7;
    this.wind.z+=(this.random()-.5)*.22-this.wind.z*h*.7;
    this.wind.clampLength(0,2.2);
    const ns=this.nodes;
    const fastLow=this.target===.72&&ns[0].pressure<this.target;
    this.lowBoost=Math.max(0,(this.lowBoost||0)-h);
    const inletTarget=this.superMode?1:this.target;
    const inletDelta=inletTarget-ns[0].pressure;
    const inletRate=inletDelta<0?DEFLATION_RATE:(fastLow?7:2.6);
    ns[0].pressure+=inletDelta*h*inletRate;
    for(let i=24;i>0;i--){
      const n=ns[i],d=n.p.clone().sub(ns[i-1].p).normalize();
      const prev=i>1?ns[i-1].p.clone().sub(ns[i-2].p).normalize():UP;
      const kink=1-clamp(d.dot(prev),-1,1);
      const supply=ns[0].pressure*.08+ns[i-1].pressure*.92*(1-.08*kink);
      n.pressure+=(supply-n.pressure)*h*(this.target===.72&&supply>n.pressure?52:28);
      const u=i/24,p=n.pressure;
      // Follower force from the internal jet, with vertical buoyant support.
      const force=new T.Vector3((this.wind.x+(this.pedalLean||0))*(1+u*2)*p-n.p.x*p*1.2,-9.81+(this.superMode?19:15)*p+(this.target===.72?6*this.lowBoost/1.6*p:0),this.wind.z*(1+u)*p-n.p.z*p*1.2);
      force.addScaledVector(d,5*p).addScaledVector(new T.Vector3(Math.sin(this.time*1.31+i*.13),0,Math.cos(this.time*.83+i*.11)),p*1.4*u);
      force.z*=this.depthMotion;
      this.integrate(n,force,h);
    }
    for(let iter=0;iter<10;iter++){
      ns[0].p.set(0,.64,0);ns[1].p.set(0,.64+4.9/24,0);
      for(let i=2;i<=24;i++)this.solveDistance(ns[i-1],ns[i],4.9/24,1,i===2);
      for(let i=2;i<24;i++){
        const p=ns[i].pressure;
        // A pressurized tube resists curvature; a depressurized one folds.
        this.solveDistance(ns[i-1],ns[i+1],4.9/12,.09+(this.superMode?1.2:.65)*p*p,i===2);
        const minSpan=2*(4.9/24)*Math.cos(.17);
        if(ns[i-1].p.distanceTo(ns[i+1].p)<minSpan)this.solveDistance(ns[i-1],ns[i+1],minSpan,.9,i===2);
      }
      for(let i=2;i<=24;i++){
        const n=ns[i],r=this.bodyRadius(n);
        if(n.p.y<r){n.p.y=r;n.old.x=T.MathUtils.lerp(n.old.x,n.p.x,.2);n.old.z=T.MathUtils.lerp(n.old.z,n.p.z,.2);}
      }
      // Nonadjacent tube sections retain a finite thickness when crumpled.
      for(let i=3;i<=24;i++)for(let j=0;j<i-2;j++){
        const a=ns[j],b=ns[i],min=this.bodyRadius(a)+this.bodyRadius(b)+.035;
        if((i-j)*4.9/24<min*1.15)continue;
        this.repelSegment(b,a,ns[j+1],min);
      }
    }
    if(this.dodgeMotion){
      const motion=this.dodgeMotion;
      const elapsed=this.time-motion.start;
      const bend=elapsed<.04?T.MathUtils.smoothstep(elapsed,0,.04):
        1-T.MathUtils.smoothstep(elapsed,.04,DODGE_DURATION);
      const position=ns[1].p.clone();
      for(let i=2;i<=24;i++){
        // Ease out of the fixed base, then trace a sideways U with a horizontal head.
        const angle=i<=4?(i-1)/3*Math.PI/2:Math.PI/2-(i-4)/20*Math.PI;
        position.x+=motion.direction*Math.sin(angle)*4.9/24;
        position.y+=Math.cos(angle)*4.9/24;
        ns[i].p.copy(motion.pose[i]).lerp(position,bend);
        ns[i].old.copy(ns[i].p);
      }
      if(elapsed>=DODGE_DURATION)this.dodgeMotion=null;
    }
    const shoulder=this.sample(SHOULDER_Y);
    for(const arm of this.arms){
      const arr=arm.nodes,anchor=this.bodyPosition(arm.sign*.5,SHOULDER_Y,0);
      arr[0].p.copy(anchor);arr[0].old.copy(anchor);arr[0].pressure=shoulder.p;
      for(let i=1;i<arr.length;i++){
        arr[i].pressure+=(arr[i-1].pressure-arr[i].pressure)*h*18;
        const p=arr[i].pressure;
        const force=new T.Vector3(this.wind.x*p,-9.81+8*p,this.wind.z*p);
        force.addScaledVector(shoulder.n,arm.sign*10*p);
        force.z*=this.depthMotion;
        this.integrate(arr[i],force,h);
      }
      for(let iter=0;iter<8;iter++){
        arr[0].p.copy(anchor);
        for(let i=1;i<arr.length;i++)this.solveDistance(arr[i-1],arr[i],1.04/6,1,i===1);
        for(let i=1;i<arr.length-1;i++)this.solveDistance(arr[i-1],arr[i+1],1.04/3,.03+.15*arr[i].pressure,i===1);
        for(let i=1;i<arr.length;i++){
          const n=arr[i],r=.12+.12*n.pressure;
          for(let j=0;j<24;j++){
            if(i<2&&j>=13&&j<=16)continue;
            this.repelSegment(n,ns[j],ns[j+1],this.bodyRadius(ns[j])+r+.035);
          }
          n.p.y=Math.max(r,n.p.y);
        }
      }
    }
    for(let pass=0;pass<3;pass++)for(let i=2;i<7;i++)for(let j=1;j<6;j++){
      this.repelSegment(this.arms[0].nodes[i],this.arms[1].nodes[j],this.arms[1].nodes[j+1],.28+.2*shoulder.p);
      this.repelSegment(this.arms[1].nodes[i],this.arms[0].nodes[j],this.arms[0].nodes[j+1],.28+.2*shoulder.p);
    }
    if(this.planar)for(const n of [...ns,...this.arms.flatMap(a=>a.nodes)]){n.p.z=0;n.old.z=0;}
  }
  sample(y){const k=clamp((y-.64)/4.9*24,0,24),i=Math.min(23,Math.floor(k)),s=k-i,a=this.nodes[i],b=this.nodes[i+1];
    const ta=this.nodes[Math.min(24,i+1)].p.clone().sub(this.nodes[Math.max(0,i-1)].p).normalize();
    const tb=this.nodes[Math.min(24,i+2)].p.clone().sub(this.nodes[i].p).normalize();
    const tangent=ta.lerp(tb,s).normalize(),q=new T.Quaternion().setFromUnitVectors(UP,tangent);
    const c=a.p.clone().lerp(b.p,s);if(y>5.54)c.addScaledVector(tangent,y-5.54);
    return {c,n:SIDE.clone().applyQuaternion(q),b:new T.Vector3(0,0,1).applyQuaternion(q),t:tangent,p:T.MathUtils.lerp(a.pressure,b.pressure,s)};
  }
  bodyPosition(x,y,z){
    const f=this.sample(y),w=T.MathUtils.smoothstep(y,.64,1.2);
    return f.c.addScaledVector(f.n,x*(1-w*(1-f.p)*.48)).addScaledVector(f.b,z*(1-w*(1-f.p)*.72));
  }
  deform(){
    for(const {mesh,rest} of this.meshes){const out=mesh.geometry.attributes.position;
      for(let i=0;i<out.count;i++){
        const x=rest[i*3],y=rest[i*3+1],z=rest[i*3+2];let pos;
        if(mesh.userData.armSign){
          const arm=this.arms[x<0?0:1],u=clamp((Math.abs(x)-.5)/1.04,0,1),k=u*6,j=Math.min(5,Math.floor(k)),s=k-j;
          const a=arm.nodes[j],b=arm.nodes[j+1];
          const ta=arm.nodes[j+1].p.clone().sub(arm.nodes[Math.max(0,j-1)].p).multiplyScalar(j===0?1:.5);
          const tb=arm.nodes[Math.min(6,j+2)].p.clone().sub(a.p).multiplyScalar(j===5?1:.5);
          const s2=s*s,s3=s2*s;
          const center=a.p.clone().multiplyScalar(2*s3-3*s2+1).addScaledVector(ta,s3-2*s2+s).addScaledVector(b.p,-2*s3+3*s2).addScaledVector(tb,s3-s2);
          const tangent=a.p.clone().multiplyScalar(6*s2-6*s).addScaledVector(ta,3*s2-4*s+1).addScaledVector(b.p,-6*s2+6*s).addScaledVector(tb,3*s2-2*s).normalize();
          const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(arm.sign,0,0),tangent),p=T.MathUtils.lerp(a.pressure,b.pressure,s);
          pos=center.add(new T.Vector3(Math.sign(x)*Math.max(0,Math.abs(x)-1.54),(y-SHOULDER_Y)*(.3+.7*p),z*(.5+.5*p)).applyQuaternion(q));
          // The buried root follows the exact torso deformation, including
          // deflation and bending; blend gradually into the free arm.
          pos.lerp(this.bodyPosition(x,y,z),1-T.MathUtils.smoothstep(u,0,.3));
        }else{
          pos=this.bodyPosition(x,y,z);
        }
        pos.y=Math.max(.025,pos.y);out.setXYZ(i,pos.x,pos.y,pos.z);
      }
      out.needsUpdate=true;mesh.geometry.computeVertexNormals();
    }
  }
}



