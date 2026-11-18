import * as T from 'three';
export const SHOULDER_Y=.64+(5.35-.64)*4.9/7.6;
export function createArm(sign){
  const positions=[],colors=[],indices=[],rings=[],sides=32;
  const shirt=new T.Color(0xc4d8e5),skin=new T.Color(0xffc9ae);
  // One indexed surface. The cuff changes vertex color, never topology/material.
  for(let i=0;i<=48;i++){
    const u=i/48;
    rings.push({x:.5+1.04*u,r:.235-.065*T.MathUtils.smoothstep(u,0,1),u});
  }
  for(let i=1;i<12;i++){
    const phi=i/12*Math.PI/2;
    rings.push({x:1.54+.17*Math.sin(phi),r:.17*Math.cos(phi),u:1});
  }
  for(const ring of rings){
    const c=shirt.clone().lerp(skin,T.MathUtils.smoothstep(ring.u,.415,.445));
    for(let j=0;j<sides;j++){
      const a=-sign*j/sides*Math.PI*2;
      positions.push(sign*ring.x,SHOULDER_Y+ring.r*Math.cos(a),ring.r*Math.sin(a));
      colors.push(c.r,c.g,c.b);
    }
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){
    const a=i*sides+j,b=(i+1)*sides+j,c=i*sides+(j+1)%sides,d=(i+1)*sides+(j+1)%sides;
    indices.push(a,b,c,b,d,c);
  }
  const tip=positions.length/3;positions.push(sign*1.71,SHOULDER_Y,0);colors.push(skin.r,skin.g,skin.b);
  for(let j=0;j<sides;j++)indices.push((rings.length-1)*sides+j,tip,(rings.length-1)*sides+(j+1)%sides);
  const geometry=new T.BufferGeometry();geometry.setIndex(indices);
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({color:0xffffff,vertexColors:true,side:T.DoubleSide}));
  mesh.name=sign<0?'Arm_left':'Arm_right';mesh.userData.armSign=sign;mesh.frustumCulled=false;
  return mesh;
}
