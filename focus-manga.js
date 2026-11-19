import * as THREE from 'three';

export function createFocusManga(scene, character, camera) {
  const atlas = new THREE.TextureLoader().load('./focus-comic-atlas.png');
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.repeat.set(.5, .5);
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({
    map: atlas, transparent: true, depthWrite: false
  }));
  bubble.name = 'Focus_backdrop';
  bubble.visible = false;
  scene.add(bubble);

  // Share the actual deformed skin, clothes and limb surfaces so ink follows their contours.
  const shading = new THREE.Group();
  shading.name = 'Focus_ink_shadows';
  shading.visible = false;
  const bodyTexture = new THREE.TextureLoader().load('./focus-contour-ink-v3.png');
  bodyTexture.colorSpace = THREE.SRGBColorSpace;
  bodyTexture.wrapS = bodyTexture.wrapT = THREE.RepeatWrapping;
  const surfaces = ['Skin', 'Shirt', 'Trousers', 'Arm_left', 'Arm_right'];
  for (const name of surfaces) {
    const surface = character.getObjectByName(name);
    const geometry = surface.geometry;
    geometry.setAttribute('inkRestPosition', geometry.attributes.position.clone());
    geometry.setAttribute('inkRestNormal', geometry.attributes.normal.clone());
    const material = new THREE.ShaderMaterial({
      uniforms: {
        bodyInk: {value: bodyTexture},
        isArm: {value: name.startsWith('Arm_') ? 1 : 0},
        isShirt: {value: name === 'Shirt' ? 1 : 0}
      },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2,
      vertexShader: `
        attribute vec3 inkRestPosition;
        attribute vec3 inkRestNormal;
        varying vec3 restPoint, restNormal;
        void main() {
          restPoint = inkRestPosition;
          restNormal = inkRestNormal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * .006, 1.);
        }
      `,
      fragmentShader: `
        uniform sampler2D bodyInk;
        uniform float isArm, isShirt;
        varying vec3 restPoint, restNormal;
        void main() {
          vec3 n = normalize(restNormal);
          // Side planes of the face/torso, and undersides of sleeves and rounded hands.
          float bodySide = smoothstep(.38, .9, abs(n.x));
          float armSide = max((1. - smoothstep(-.82, -.12, n.y)), smoothstep(.45, .95, abs(n.x)));
          float shade = mix(bodySide, armSide, isArm);
          vec2 bodyUV = vec2(atan(restPoint.z, restPoint.x) / 6.28318 + .5, restPoint.y / 2.4);
          vec2 armUV = vec2(abs(restPoint.x) / 1.4, atan(n.z, n.y) / 6.28318 + .5);
          float strokes = texture2D(bodyInk, mix(bodyUV, armUV, isArm)).a;
          float ink = shade * (.10 + .8 * strokes);
          // A little ink reaches the outer shirt folds while its center remains clear.
          ink = max(ink, isShirt * smoothstep(.15, .5, abs(restPoint.x)) * strokes * .65);
          gl_FragColor = vec4(.065, .055, .08, ink);
          #include <colorspace_fragment>
        }
      `
    });
    const ink = new THREE.Mesh(geometry, material);
    ink.name = 'Focus_contour_' + name;
    ink.frustumCulled = false;
    ink.renderOrder = 3;
    shading.add(ink);
  }
  character.add(shading);

  let active = false, age = 0, variant = Math.floor(Math.random() * 4);
  const behind = new THREE.Vector3();
  return {
    update(dt, simulation) {
      const focused = Boolean(simulation.superMode);
      if (focused && !active) {
        variant = (variant + 1 + Math.floor(Math.random() * 3)) % 4;
        atlas.offset.set(variant % 2 * .5, variant < 2 ? .5 : 0);
        age = 0;
      }
      active = focused;
      bubble.visible = shading.visible = focused;
      if (!focused) return;
      age += dt;
      const head = simulation.sample(4.85).c;
      behind.set(0, 0, -1).applyQuaternion(camera.quaternion);
      bubble.position.copy(head).addScaledVector(behind, 1.4);
      const entrance = THREE.MathUtils.smoothstep(age, 0, .22);
      const scale = 3.8 * entrance * (1 + .12 * Math.sin(Math.min(1, age / .4) * Math.PI));
      bubble.scale.set(scale, scale, 1);
    }
  };
}
