import type { Simulation } from "./simulation";
export interface ProfileReport {
  frames: number;
  meanFps: number;
  p95FrameMs: number;
  maxEntities: number;
  elapsed: number;
  health: number;
  score: number;
  reason: string | null;
}
export class Telemetry {
  private intervals: number[] = [];
  private last = 0;
  private maxEntities = 0;
  sample(now: number, sim: Simulation) {
    if (sim.paused) {
      this.last = 0;
      return;
    }
    if (this.last) this.intervals.push(now - this.last);
    this.last = now;
    this.maxEntities = Math.max(
      this.maxEntities,
      1 + sim.enemies.length + sim.bullets.length + sim.effects.length,
    );
  }
  report(sim: Simulation): ProfileReport {
    const sorted = [...this.intervals].sort((a, b) => a - b),
      total = sorted.reduce((a, b) => a + b, 0);
    return {
      frames: sorted.length,
      meanFps: total ? (1000 * sorted.length) / total : 0,
      p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      maxEntities: this.maxEntities,
      elapsed: sim.elapsed,
      health: sim.player.hp,
      score: sim.score,
      reason: sim.ended,
    };
  }
}
