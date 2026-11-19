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

  // Ribbons use the same rest-space coordinates and deformation as the skin.
  const vertices = [];
  function stroke(x, y, dx, dy, width = .012) {
    const length = Math.hypot(dx, dy);
    const nx = -dy / length * width / 2;
    const ny = dx / length * width / 2;
    function point(a, b) {
      const radius = .66 - .025 * (b - .64) / 4.9;
      return [a, b, Math.sqrt(Math.max(.01, radius * radius - a * a)) + .03];
    }
    const a = point(x - nx, y - ny), b = point(x + nx, y + ny);
    const c = point(x + dx, y + dy);
    vertices.push(...a, ...b, ...c);
  }
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 18; i++) {
      stroke(sign * (.43 + i % 3 * .028), 4.23 + i * .049, -sign * .10, -.12);
    }
    for (let i = 0; i < 13; i++) {
      stroke(sign * (.21 + i * .022), 4.55 - i * .012, sign * .045, -.16);
    }
    for (let i = 0; i < 28; i++) {
      stroke(sign * .56, 1.65 + i * .073, -sign * (.13 + .07 * Math.sin(i * .3)), -.18, .017);
    }
    for (let i = 0; i < 8; i++) {
      stroke(sign * (.16 + i * .035), 3.61 - i * .025, sign * .06, -.18, .014);
    }
  }
  for (let i = 0; i < 20; i++) stroke(-.40 + i * .04, 5.13, .025, -.12 - .06 * Math.sin(i * .16));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const shading = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: '#20202a', side: THREE.DoubleSide, transparent: true, opacity: .85,
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
