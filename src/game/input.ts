import type { Action, Simulation } from "./simulation";

const keys: Record<string, Action> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "reverse",
  ArrowDown: "reverse",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "front",
  KeyQ: "port",
  KeyE: "starboard",
};

export class InputController {
  private sources = new Map<string, readonly Action[]>();
  constructor(private sim: Simulation) {}

  press(source: string, actions: readonly Action[]) {
    if (this.sim.paused || this.sim.ended) return;
    this.sources.set(source, actions);
    for (const action of actions) this.sim.input.add(action);
  }
  release(source: string) {
    const actions = this.sources.get(source);
    this.sources.delete(source);
    for (const action of actions ?? []) {
      if (![...this.sources.values()].some((held) => held.includes(action)))
        this.sim.input.delete(action);
    }
  }
  clear() {
    this.sources.clear();
    this.sim.input.clear();
  }
}

export function bindKeyboard(input: InputController, pause: () => void) {
  const down = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLElement &&
      e.target.closest(
        "button,input,select,textarea,dialog,[contenteditable=true]",
      )
    )
      return;
    if (e.code === "Escape" || e.code === "KeyP") {
      e.preventDefault();
      if (!e.repeat) pause();
      return;
    }
    const action = keys[e.code];
    if (action) {
      e.preventDefault();
      if (!e.repeat) input.press(`key:${e.code}`, [action]);
    }
  };
  const up = (e: KeyboardEvent) => input.release(`key:${e.code}`);
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    input.clear();
  };
}

export function bindMouse(input: InputController, arena: HTMLElement) {
  const down = (e: MouseEvent) => {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    input.press(
      `mouse:${e.button}`,
      e.button === 0 ? ["front"] : ["port", "starboard"],
    );
  };
  const up = (e: MouseEvent) => input.release(`mouse:${e.button}`);
  const menu = (e: MouseEvent) => e.preventDefault();
  arena.addEventListener("mousedown", down);
  arena.addEventListener("contextmenu", menu);
  window.addEventListener("mouseup", up);
  return () => {
    arena.removeEventListener("mousedown", down);
    arena.removeEventListener("contextmenu", menu);
    window.removeEventListener("mouseup", up);
    input.clear();
  };
}
