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

  // A subdivided decal wraps the generated ink around the shirt and follows the solver.
  const vertices = [], uv = [], indices = [];
  const columns = 32, rows = 52;
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const u = column / columns, v = row / rows;
      const x = (u - .5) * 1.25, y = 1.58 + v * 2.20;
      const radius = .66 - .025 * (y - .64) / 4.9;
      vertices.push(x, y, Math.sqrt(Math.max(.01, radius * radius - x * x)) + .022);
      uv.push(u, v);
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column, b = a + columns + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const bodyTexture = new THREE.TextureLoader().load('./focus-body-hatched-v2.png');
  bodyTexture.colorSpace = THREE.SRGBColorSpace;
  bodyTexture.anisotropy = 4;
  const shading = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    map: bodyTexture, side: THREE.DoubleSide, transparent: true,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
  }));
  shading.name = 'Focus_ink_shadows';
  shading.userData.deformWithBody = true;
  shading.frustumCulled = false;
  shading.renderOrder = 3;
  shading.visible = false;
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
