import * as THREE from 'three';

// Preview shading remains separate from the portable glTF PBR materials.
export function applyToon(root) {
  const gradient=new THREE.DataTexture(new Uint8Array([65,110,180,245]),4,1,THREE.RedFormat);
  gradient.minFilter=gradient.magFilter=THREE.NearestFilter;
  gradient.generateMipmaps=false;gradient.needsUpdate=true;
  root.traverse(o=>{
    if(!o.isMesh)return;
    const original=o.material;
    const fabric=['Shirt','Skin','Hair','Trousers'].includes(o.name);
    if(o.name==='White_details'||o.name==='Face_ink') {
      o.material=new THREE.MeshBasicMaterial({color:original.color,side:THREE.DoubleSide});
      o.material.userData.outlineParameters={visible:false};
      return;
    }
    const mat=new THREE.MeshToonMaterial({color:original.color,gradientMap:gradient,side:original.side});
    mat.userData.outlineParameters={visible:fabric||o.name==='Blower',thickness:fabric?.0016:.0012,color:[.10,.13,.15]};
    if(fabric){
      mat.onBeforeCompile=shader=>{
        const highlights={Shirt:0xf5fbff,Skin:0xffe4d2,Hair:0x72726d,Trousers:0x778ca3};
        shader.uniforms.balloonGlossColor={value:new THREE.Color(highlights[o.name])};
        shader.uniforms.balloonGlossStrength={value:o.name==='Hair'?.32:.52};
        shader.fragmentShader='uniform vec3 balloonGlossColor;\nuniform float balloonGlossStrength;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
          vec3 balloonHalf = normalize(normalize(vec3(-0.65, 0.8, 1.0)) + normalize(vViewPosition));
          float balloonGloss = smoothstep(0.935, 0.965, dot(normal, balloonHalf));
          outgoingLight = mix(outgoingLight, balloonGlossColor, balloonGloss * balloonGlossStrength);
          #include <opaque_fragment>
        `);
      };
    }
    o.material=mat;
  });
}
