import * as T from 'three';

// Outline the union of the character's visible surfaces. Unlike an expanded
// backface shell, this cannot draw black strokes inside wrists or folds.
export class SilhouetteEffect {
  constructor(renderer,character){
    this.renderer=renderer;
    character.traverse(o=>o.layers.enable(1));
    this.color=new T.WebGLRenderTarget(1,1,{samples:4});
    this.mask=new T.WebGLRenderTarget(1,1,{samples:4});
    this.white=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide});
    this.black=new T.Color(0);
    this.size=new T.Vector2();
    this.material=new T.ShaderMaterial({
      depthTest:false,depthWrite:false,
      uniforms:{colorMap:{value:this.color.texture},maskMap:{value:this.mask.texture},texel:{value:new T.Vector2()},width:{value:3.5},ink:{value:new T.Color('#303b34')}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`
        varying vec2 vUv;
        uniform sampler2D colorMap,maskMap;
        uniform vec2 texel;
        uniform float width;
        uniform vec3 ink;
        void main(){
          float center=texture2D(maskMap,vUv).r;
          float expanded=center;
          for(int radius=1;radius<=2;radius++){
            for(int i=0;i<24;i++){
              float angle=float(i)*6.28318530718/24.;
              vec2 offset=vec2(cos(angle),sin(angle))*texel*width*float(radius)*.5;
              expanded=max(expanded,texture2D(maskMap,vUv+offset).r);
            }
          }
          vec3 color=texture2D(colorMap,vUv).rgb;
          gl_FragColor=vec4(mix(color,ink,max(0.,expanded-center)),1.);
          #include <colorspace_fragment>
        }`
    });
    this.quadScene=new T.Scene();
    this.quadScene.add(new T.Mesh(new T.PlaneGeometry(2,2),this.material));
    this.camera=new T.Camera();
  }
  render(scene,camera){
    const r=this.renderer;r.getDrawingBufferSize(this.size);
    if(this.color.width!==this.size.x||this.color.height!==this.size.y){
      this.color.setSize(this.size.x,this.size.y);this.mask.setSize(this.size.x,this.size.y);
      this.material.uniforms.texel.value.set(1/this.size.x,1/this.size.y);
    }
    this.material.uniforms.width.value=3.5*r.getPixelRatio();
    const target=r.getRenderTarget(),background=scene.background,override=scene.overrideMaterial,layers=camera.layers.mask;
    try{
      r.setRenderTarget(this.color);r.clear();r.render(scene,camera);
      scene.background=this.black;scene.overrideMaterial=this.white;camera.layers.set(1);
      r.setRenderTarget(this.mask);r.clear();r.render(scene,camera);
    }finally{
      scene.background=background;scene.overrideMaterial=override;camera.layers.mask=layers;r.setRenderTarget(target);
    }
    r.render(this.quadScene,this.camera);
  }
}
