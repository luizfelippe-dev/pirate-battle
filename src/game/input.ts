import type { Action, Simulation } from "./simulation";
const keys: Record<string, Action> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "front",
  KeyQ: "port",
  KeyE: "starboard",
};
export function bindKeyboard(sim: Simulation, pause: () => void) {
  const down = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLElement &&
      e.target.closest("button,input,select,dialog")
    )
      return;
    if (e.code === "Escape" || e.code === "KeyP") {
      e.preventDefault();
      if (!e.repeat) pause();
      return;
    }
    const action = keys[e.code];
    if (action && !sim.paused && !sim.ended) {
      e.preventDefault();
      sim.input.add(action);
    }
  };
  const up = (e: KeyboardEvent) => {
    const a = keys[e.code];
    if (a && !sim.paused && !sim.ended) {
      e.preventDefault();
      sim.input.delete(a);
    }
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    sim.input.clear();
  };
}
