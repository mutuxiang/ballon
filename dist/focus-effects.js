// Four hand-inked motifs share one transparent atlas.
export function createFocusEffects(ctx, source) {
  const atlas = new Image();
  atlas.src = source;
  let particles = [];
  let variant = Math.floor(Math.random() * 4);
  return {
    burst(x, y, radius, count = 4) {
      const phase = Math.random() * Math.PI * 2;
      for (let i = 0; i < count; i++) {
        particles.push({
          x, y, radius, angle: phase + i * Math.PI * 2 / count,
          variant: variant++ % 4, age: -i * .07,
          life: 1.25 + Math.random() * .3,
          rotation: (Math.random() - .5) * .6,
          size: radius * (.85 + Math.random() * .3)
        });
      }
    },
    clear() { particles = []; },
    draw(dt, width, height) {
      for (const particle of particles) particle.age += dt;
      particles = particles.filter(particle => particle.age < particle.life);
      if (!atlas.complete || !atlas.naturalWidth) return;
      const cellWidth = atlas.naturalWidth / 2;
      const cellHeight = atlas.naturalHeight / 2;
      for (const particle of particles) {
        if (particle.age < 0) continue;
        const progress = particle.age / particle.life;
        const enter = Math.min(1, progress / .18);
        const size = particle.size * enter * (1 + Math.sin(enter * Math.PI) * .22);
        const distance = particle.radius * (1.65 + progress * .8);
        const margin = particle.size * .55;
        const x = Math.max(margin, Math.min(width - margin, particle.x + Math.cos(particle.angle) * distance));
        const y = Math.max(margin, Math.min(height - margin, particle.y + Math.sin(particle.angle) * distance));
        ctx.save();
        ctx.globalAlpha = Math.min(1, (1 - progress) / .35);
        ctx.translate(x, y);
        ctx.rotate(particle.rotation * (1 + progress));
        ctx.drawImage(atlas, particle.variant % 2 * cellWidth,
          Math.floor(particle.variant / 2) * cellHeight, cellWidth, cellHeight,
          -size / 2, -size / 2, size, size);
        ctx.restore();
      }
    }
  };
}
