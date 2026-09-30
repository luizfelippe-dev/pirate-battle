export const ARENA = { width: 1200, height: 720 } as const;
export interface Options {
  duration: number;
  spawnInterval: number;
}
export const defaults: Options = { duration: 90, spawnInterval: 4 };
export const balance = {
  version: 2,
  step: 1 / 120,
  player: { health: 100, speed: 195, reverseSpeed: 110, turn: 2.8, radius: 23 },
  chaser: { health: 40, speed: 105, turn: 2, radius: 22, damage: 22 },
  shooter: {
    health: 60,
    speed: 75,
    turn: 1.8,
    radius: 24,
    range: 360,
    cooldown: 2.4,
  },
  shot: {
    speed: 420,
    life: 1.65,
    damage: 20,
    radius: 5,
    frontCooldown: 0.38,
    sideCooldown: 1.2,
  },
  enemyShot: { speed: 235, life: 2.5, damage: 12 },
  spawn: {
    minimumDistance: 330,
    pattern: ["chaser", "shooter", "chaser"] as const,
  },
};
export const islands = [
  { x: 370, y: 245, radius: 70 },
  { x: 830, y: 480, radius: 82 },
  { x: 1000, y: 150, radius: 48 },
];
export function validOptions(value: unknown): value is Options {
  const o = value as Options | null;
  return (
    !!o &&
    Number.isInteger(o.duration) &&
    o.duration >= 60 &&
    o.duration <= 180 &&
    Number.isFinite(o.spawnInterval) &&
    o.spawnInterval >= 1 &&
    o.spawnInterval <= 10
  );
}
