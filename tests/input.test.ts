import { it, expect } from "vitest";
import { InputController } from "../src/game/input";
import { Simulation } from "../src/game/simulation";
import { defaults, ARENA } from "../src/game/config";

it("keeps an action held until its last input source releases", () => {
  const sim = new Simulation(defaults),
    input = new InputController(sim);
  input.press("keyboard", ["front"]);
  input.press("mouse", ["front"]);
  input.release("mouse");
  expect(sim.input.has("front")).toBe(true);
  input.release("keyboard");
  expect(sim.input.has("front")).toBe(false);
});

it("clears held sources at pause and ignores input while paused", () => {
  const sim = new Simulation(defaults),
    input = new InputController(sim);
  input.press("touch", ["forward", "front"]);
  input.clear();
  sim.setPaused(true);
  input.press("mouse", ["port", "starboard"]);
  sim.setPaused(false);
  input.press("keyboard", ["right"]);
  expect([...sim.input]).toEqual(["right"]);
});

it("reverses within the arena and neutralizes opposed thrust", () => {
  const sim = new Simulation(defaults);
  sim.input.add("reverse");
  sim.advance(0.5);
  expect(sim.player.y).toBeCloseTo(605);
  sim.input.add("forward");
  sim.advance(0.5);
  expect(sim.player.y).toBeCloseTo(605);
  sim.input.delete("forward");
  sim.advance(1);
  expect(sim.player.y).toBeLessThanOrEqual(ARENA.height - sim.player.radius);
});
