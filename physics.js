import * as T from 'three';
const UP=new T.Vector3(0,1,0),SIDE=new T.Vector3(1,0,0);
const clamp=T.MathUtils.clamp;
// Fixed-step position-based elastic rod. Pressure is transported upwards and
// attenuated by kinks; gravity, drag and correlated gusts drive the motion.
export class AirPhysics {
  constructor(root,{seed=28713}={}){
    this.seed=seed;this.target=1;this.time=0;this.acc=0;this.wind=new T.Vector3();
    this.nodes=Array.from({length:25},(_,i)=>({p:new T.Vector3(.035*Math.sin(i*.3),.64+i*4.9/24,0),old:new T.Vector3(.035*Math.sin(i*.3),.64+i*4.9/24,0),pressure:1}));
    this.arms=[-1,1].map(sign=>({sign,nodes:Array.from({length:7},(_,i)=>({p:new T.Vector3(sign*(.5+i*1.04/6),3.677,0),old:new T.Vector3(sign*(.5+i*1.04/6),3.677,0),pressure:1}))}));
    this.meshes=[];root.traverse(o=>{if(o.isMesh&&['Shirt','Skin','Hair','Trousers','Face_ink','White_details'].includes(o.name)){this.meshes.push({mesh:o,rest:o.geometry.attributes.position.array.slice()});o.frustumCulled=false;}});
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  setState(s){this.target={none:0,low:.72,high:1}[s];}
  update(dt){this.acc+=Math.min(dt,.1);while(this.acc>=1/120){this.step(1/120);this.acc-=1/120;}this.deform();}
  solveDistance(a,b,length,strength=1,fixed=false){const d=b.p.clone().sub(a.p),len=d.length();if(len<1e-7)return;d.multiplyScalar((len-length)/len*strength);if(fixed)b.p.sub(d);else{a.p.addScaledVector(d,.5);b.p.addScaledVector(d,-.5);}}
  integrate(n,force,h){const v=n.p.clone().sub(n.old).multiplyScalar(.993);n.old.copy(n.p);n.p.add(v).addScaledVector(force,h*h);}
  step(h){
    this.time+=h;
    this.wind.x+=(this.random()-.5)*.35-this.wind.x*h*.7;
    this.wind.z+=(this.random()-.5)*.22-this.wind.z*h*.7;
    this.wind.clampLength(0,2.2);
    const ns=this.nodes;
    ns[0].pressure+=(this.target-ns[0].pressure)*h*2.6;
    for(let i=24;i>0;i--){
      const n=ns[i],d=n.p.clone().sub(ns[i-1].p).normalize();
      const prev=i>1?ns[i-1].p.clone().sub(ns[i-2].p).normalize():UP;
      const kink=1-clamp(d.dot(prev),-1,1);
      const supply=ns[0].pressure*.08+ns[i-1].pressure*.92*(1-.08*kink);
      n.pressure+=(supply-n.pressure)*h*28;
      const u=i/24,p=n.pressure;
      // Follower force from the internal jet, with vertical buoyant support.
      const force=new T.Vector3(this.wind.x*(1+u*2)*p-n.p.x*p*1.2,-9.81+15*p,this.wind.z*(1+u)*p-n.p.z*p*1.2);
      force.addScaledVector(d,5*p).addScaledVector(new T.Vector3(Math.sin(this.time*1.31+i*.13),0,Math.cos(this.time*.83+i*.11)),p*1.4*u);
      this.integrate(n,force,h);
    }
    for(let iter=0;iter<10;iter++){
      ns[0].p.set(0,.64,0);ns[1].p.set(0,.64+4.9/24,0);
      for(let i=2;i<=24;i++)this.solveDistance(ns[i-1],ns[i],4.9/24,1,i===2);
      for(let i=2;i<24;i++){
        const p=ns[i].pressure;
        // A pressurized tube resists curvature; a depressurized one folds.
        this.solveDistance(ns[i-1],ns[i+1],4.9/12,.018+.65*p*p,i===2);
      }
      for(let i=2;i<=24;i++){
        const n=ns[i],r=.16+.46*n.pressure;
        if(n.p.y<r){n.p.y=r;n.old.x=T.MathUtils.lerp(n.old.x,n.p.x,.2);n.old.z=T.MathUtils.lerp(n.old.z,n.p.z,.2);}
      }
    }
    const shoulder=this.sample(3.677);
    for(const arm of this.arms){
      const arr=arm.nodes,anchor=shoulder.c.clone().addScaledVector(shoulder.n,arm.sign*.5);
      arr[0].p.copy(anchor);arr[0].old.copy(anchor);arr[0].pressure=shoulder.p;
      for(let i=1;i<arr.length;i++){
        arr[i].pressure+=(arr[i-1].pressure-arr[i].pressure)*h*18;
        const p=arr[i].pressure;
        const force=new T.Vector3(this.wind.x*p,-9.81+8*p,this.wind.z*p);
        force.addScaledVector(shoulder.n,arm.sign*10*p);
        this.integrate(arr[i],force,h);
      }
      for(let iter=0;iter<8;iter++){
        arr[0].p.copy(anchor);
        for(let i=1;i<arr.length;i++)this.solveDistance(arr[i-1],arr[i],1.04/6,1,i===1);
        for(let i=1;i<arr.length-1;i++)this.solveDistance(arr[i-1],arr[i+1],1.04/3,.03+.15*arr[i].pressure,i===1);
        for(let i=1;i<arr.length;i++)arr[i].p.y=Math.max(.09,arr[i].p.y);
      }
    }
  }
  sample(y){const k=clamp((y-.64)/4.9*24,0,24),i=Math.min(23,Math.floor(k)),s=k-i,a=this.nodes[i],b=this.nodes[i+1];
    const tangent=b.p.clone().sub(a.p).normalize(),q=new T.Quaternion().setFromUnitVectors(UP,tangent);
    const c=a.p.clone().lerp(b.p,s);if(y>5.54)c.addScaledVector(tangent,y-5.54);
    return {c,n:SIDE.clone().applyQuaternion(q),b:new T.Vector3(0,0,1).applyQuaternion(q),t:tangent,p:T.MathUtils.lerp(a.pressure,b.pressure,s)};
  }
  deform(){
    for(const {mesh,rest} of this.meshes){const out=mesh.geometry.attributes.position;
      for(let i=0;i<out.count;i++){
        const x=rest[i*3],y=rest[i*3+1],z=rest[i*3+2];let pos;
        if(Math.abs(x)>.67&&Math.abs(y-3.677)<.3){
          const arm=this.arms[x<0?0:1],u=clamp((Math.abs(x)-.5)/1.04,0,1),k=u*6,j=Math.min(5,Math.floor(k)),s=k-j;
          const a=arm.nodes[j],b=arm.nodes[j+1],q=new T.Quaternion().setFromUnitVectors(new T.Vector3(arm.sign,0,0),b.p.clone().sub(a.p).normalize());
          pos=a.p.clone().lerp(b.p,s).add(new T.Vector3(Math.sign(x)*Math.max(0,Math.abs(x)-1.54),(y-3.677)*(.3+.7*a.pressure),z*(.5+.5*a.pressure)).applyQuaternion(q));
        }else{
          const f=this.sample(y),p=f.p,w=T.MathUtils.smoothstep(y,.64,1.2),r=1-w*(1-p)*.48;
          pos=f.c.addScaledVector(f.n,x*r).addScaledVector(f.b,z*(1-w*(1-p)*.72));
        }
        pos.y=Math.max(.025,pos.y);out.setXYZ(i,pos.x,pos.y,pos.z);
      }
      out.needsUpdate=true;mesh.geometry.computeVertexNormals();
    }
  }
}



