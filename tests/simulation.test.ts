import { describe, it, expect } from "vitest";
import { Simulation } from "../src/game/simulation";
import { defaults, islands } from "../src/game/config";
describe("fixed-step naval simulation", () => {
  it("preserves movement across frame rates", () => {
    const a = new Simulation(defaults),
      b = new Simulation(defaults);
    a.input.add("forward");
    b.input.add("forward");
    for (let n = 0; n < 60; n++) a.advance(1 / 60);
    for (let n = 0; n < 144; n++) b.advance(1 / 144);
    expect(a.player.y).toBeCloseTo(b.player.y, 6);
  });
  it("does not cross islands or arena boundaries", () => {
    const s = new Simulation(defaults);
    s.player.x = islands[0].x;
    s.player.y = 500;
    s.input.add("forward");
    s.advance(10);
    expect(s.player.y).toBeGreaterThanOrEqual(
      islands[0].y + islands[0].radius + s.player.radius,
    );
    s.player.x = 600;
    s.player.y = 50;
    s.advance(10);
    expect(s.player.y).toBeGreaterThanOrEqual(s.player.radius);
  });
  it("suspends time and clears input during pause", () => {
    const s = new Simulation(defaults);
    s.input.add("front");
    s.setPaused(true);
    s.advance(20);
    expect(s.elapsed).toBe(0);
    expect(s.bullets).toHaveLength(0);
    s.setPaused(false);
    s.advance(0.1);
    expect(s.bullets).toHaveLength(0);
  });
  it("fires parallel broadsides and applies separate cooldowns", () => {
    const s = new Simulation(defaults);
    s.input.add("port");
    s.input.add("starboard");
    s.advance(0.01);
    expect(s.bullets).toHaveLength(6);
    expect(new Set(s.bullets.slice(0, 3).map((b) => b.vx)).size).toBe(1);
    s.advance(0.1);
    expect(s.bullets).toHaveLength(6);
  });
  it("awards a kill once and removes dead targets", () => {
    const s = new Simulation(defaults);
    s.enemies.push({
      id: 100,
      kind: "shooter",
      x: 600,
      y: 430,
      angle: 0,
      hp: 20,
      maxHp: 60,
      radius: 24,
      cooldown: 99,
      hit: 0,
    });
    s.input.add("front");
    s.advance(0.25);
    expect(s.score).toBe(1);
    expect(s.enemies).toHaveLength(0);
    s.advance(0.3);
    expect(s.score).toBe(1);
  });
  it("does not reward chaser self-destruction", () => {
    const s = new Simulation(defaults);
    s.enemies.push({
      id: 100,
      kind: "chaser",
      x: 600,
      y: 549,
      angle: 0,
      hp: 40,
      maxHp: 40,
      radius: 22,
      cooldown: 0,
      hit: 0,
    });
    s.advance(0.01);
    expect(s.score).toBe(0);
    expect(s.player.hp).toBe(78);
    expect(s.enemies).toHaveLength(0);
  });
  it("spawns both enemy types safely and deterministically", () => {
    const a = new Simulation({ ...defaults, spawnInterval: 1 }),
      b = new Simulation({ ...defaults, spawnInterval: 1 });
    a.advance(2.1);
    b.advance(2.1);
    expect(a.enemies.map((e) => e.kind)).toEqual(["chaser", "shooter"]);
    expect(a.enemies).toEqual(b.enemies);
  });
  it("freezes all rules after a time or health ending", () => {
    const s = new Simulation({ ...defaults, duration: 60, spawnInterval: 10 });
    s.player.hp = 10000;
    s.advance(61);
    expect(s.ended).toBe("time");
    const before = JSON.stringify(s);
    s.advance(10);
    expect(JSON.stringify(s)).toBe(before);
  });
});
