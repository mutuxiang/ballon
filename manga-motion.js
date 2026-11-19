export function createMangaMotion(camera) {
  let wasFocused = false, burst = 0;
  return {
    get burst() { return burst; },
    update(dt, simulation, ink = '#202421') {
      if (dt <= 0) return;
      const focused = Boolean(simulation.superMode);
      if (focused && !wasFocused) {
        burst = 1;
        const head = simulation.sample(4.85).c.project(camera);
        window.desktopPet?.burst({
          x: (head.x + 1) * innerWidth / 2,
          y: (1 - head.y) * innerHeight / 2,
          ink
        });
      }
      wasFocused = focused;
      burst = focused ? Math.max(0, burst - dt / 1.1) : 0;
    }
  };
}
