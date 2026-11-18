import * as THREE from 'three';

export function createSelfieSkin({character,simulation,skins,skinGradient,setExpressionMode}) {
  const meshes=[],textures=[],saved=[];let active=false,previousGradient=false;
  function remember(mesh){
    if(!mesh||saved.some(s=>s.mesh===mesh))return;
    saved.push({mesh,visible:mesh.visible,color:mesh.material.color.clone(),
      colors:mesh.geometry.attributes.color?.array.slice()});
  }
  function add(geometry,material,name){
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;
    mesh.userData.deformWithBody=true;mesh.frustumCulled=false;mesh.layers.enable(1);
    character.add(mesh);meshes.push(mesh);
    simulation.meshes.push({mesh,rest:geometry.attributes.position.array.slice()});
  }
  function cylinder(canvas,lo,hi,name){
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;textures.push(map);
    const positions=[],uv=[],indices=[],cols=96,rows=56;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const u=i/cols,v=j/rows,a=(u-.5)*Math.PI*2,y=lo+(hi-lo)*v,r=.66-.025*(y-.64)/4.9+.027;
      positions.push(Math.sin(a)*r,y,Math.cos(a)*r);uv.push(u,v);
    }
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    add(geometry,new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}),name);
  }
  function clear(){
    for(const mesh of meshes){
      character.remove(mesh);const i=simulation.meshes.findIndex(m=>m.mesh===mesh);if(i>=0)simulation.meshes.splice(i,1);
      mesh.geometry.dispose();mesh.material.dispose();
    }
    meshes.length=0;for(const texture of textures)texture.dispose();textures.length=0;
    for(const s of saved){s.mesh.visible=s.visible;s.mesh.material.color.copy(s.color);
      if(s.colors){s.mesh.geometry.attributes.color.array.set(s.colors);s.mesh.geometry.attributes.color.needsUpdate=true;}}
    saved.length=0;
    if(active){active=false;skins.select(skins.active);skinGradient.setEnabled(previousGradient);}
    delete character.userData.selfie;
  }
  function apply(art){
    clear();previousGradient=skinGradient.enabled;setExpressionMode('manual');skinGradient.setEnabled(false);
    active=true;
    try{
      for(const name of ['Skin','Hair','Original_face_ink','Original_face_white','Expression_print','White_details','Face_ink','Clothing_internal_lines','Clothing_cuff_-1','Clothing_cuff_1']){
        const mesh=character.getObjectByName(name);remember(mesh);if(mesh)mesh.visible=false;
      }
      const f=art.features,shirtColor=new THREE.Color(f.shirt),skinColor=new THREE.Color(f.skin);
      const shirt=character.getObjectByName('Shirt');remember(shirt);shirt.material.color.copy(shirtColor);
      for(const name of ['Arm_left','Arm_right']){
        const mesh=character.getObjectByName(name);remember(mesh);
        const entry=simulation.meshes.find(m=>m.mesh===mesh),colors=mesh.geometry.attributes.color;
        for(let i=0;i<colors.count;i++){
          const u=(Math.abs(entry.rest[i*3])-.5)/1.04;
          const c=shirtColor.clone().lerp(skinColor,THREE.MathUtils.smoothstep(u,.415,.445));colors.setXYZ(i,c.r,c.g,c.b);
        }colors.needsUpdate=true;
      }
      cylinder(art.head,3.87,5.54,'Selfie_head');cylinder(art.shirt,1.678,3.87,'Selfie_garment');
      const cap=new THREE.SphereGeometry(.662,64,16,0,Math.PI*2,0,Math.PI/2);
      cap.scale(1,.4,1);cap.translate(0,5.54,0);
      add(cap,new THREE.MeshBasicMaterial({color:f.hair,side:THREE.DoubleSide}),'Selfie_crown');
      character.userData.selfie={version:2,features:{...f}};simulation.deform();
    }catch(error){clear();throw error;}
  }
  return {apply,clear,get active(){return active;}};
}
