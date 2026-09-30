import { it, expect } from "vitest";
import { Simulation } from "../src/game/simulation";
import { defaults } from "../src/game/config";
export const course = [
  [1100, 630],
  [1140, 80],
  [650, 60],
  [80, 70],
  [65, 630],
  [600, 650],
];
it.each([30, 60, 120])(
  "the six-second-spawn profiling course is survivable at %i steering updates",
  (rate) => {
    const sim = new Simulation({
      ...defaults,
      duration: 180,
      spawnInterval: 6,
    });
    let waypoint = 0;
    for (let frame = 0; frame < 180 * rate + 2 && !sim.ended; frame++) {
      const p = sim.player,
        target = course[waypoint];
      if (Math.hypot(p.x - target[0], p.y - target[1]) < 65)
        waypoint = (waypoint + 1) % course.length;
      const desired = Math.atan2(target[1] - p.y, target[0] - p.x),
        delta = Math.atan2(
          Math.sin(desired - p.angle),
          Math.cos(desired - p.angle),
        );
      sim.input.clear();
      sim.input.add("forward");
      sim.input.add("front");
      sim.input.add("port");
      sim.input.add("starboard");
      if (delta > 0.05) sim.input.add("right");
      if (delta < -0.05) sim.input.add("left");
      sim.advance(1 / rate);
    }
    expect(sim.ended).toBe("time");
    expect(sim.player.hp).toBeGreaterThan(0);
  },
);
