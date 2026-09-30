import { ARENA, balance as b, islands, type Options } from "./config";
export type Action =
  "forward" | "left" | "right" | "front" | "port" | "starboard";
export type Kind = "player" | "chaser" | "shooter";
export interface Ship {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  radius: number;
  cooldown: number;
  hit: number;
}
export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  friendly: boolean;
}
export interface Effect {
  id: number;
  x: number;
  y: number;
  life: number;
  total: number;
  kind: "blast" | "hit" | "muzzle";
}
export type EndReason = "time" | "sunk";
const distance = (a: { x: number; y: number }, c: { x: number; y: number }) =>
  Math.hypot(a.x - c.x, a.y - c.y);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export class Simulation {
  readonly config: Readonly<Options>;
  readonly input = new Set<Action>();
  player: Ship = {
    id: 0,
    kind: "player",
    x: 600,
    y: 550,
    angle: -Math.PI / 2,
    hp: b.player.health,
    maxHp: b.player.health,
    radius: b.player.radius,
    cooldown: 0,
    hit: 0,
  };
  enemies: Ship[] = [];
  bullets: Bullet[] = [];
  effects: Effect[] = [];
  elapsed = 0;
  score = 0;
  paused = false;
  ended: EndReason | null = null;
  private nextId = 1;
  private spawnClock = 0;
  private spawnIndex = 0;
  private remainder = 0;
  private cooldowns = { front: 0, port: 0, starboard: 0 };
  private seed: number;
  constructor(options: Options, seed = 7321) {
    this.config = Object.freeze({ ...options });
    this.seed = seed;
  }
  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  setPaused(value: boolean) {
    this.paused = value;
    this.input.clear();
    this.remainder = 0;
  }
  advance(seconds: number) {
    if (this.paused || this.ended) return;
    this.remainder += seconds;
    while (this.remainder + 1e-10 >= b.step && !this.ended) {
      this.tick(b.step);
      this.remainder = Math.max(0, this.remainder - b.step);
    }
  }
  private free(x: number, y: number, r: number) {
    return (
      x >= r &&
      y >= r &&
      x <= ARENA.width - r &&
      y <= ARENA.height - r &&
      islands.every((i) => Math.hypot(x - i.x, y - i.y) > i.radius + r)
    );
  }
  private move(ship: Ship, speed: number, dt: number) {
    const dx = Math.cos(ship.angle) * speed * dt,
      dy = Math.sin(ship.angle) * speed * dt;
    if (this.free(ship.x + dx, ship.y, ship.radius)) ship.x += dx;
    if (this.free(ship.x, ship.y + dy, ship.radius)) ship.y += dy;
  }
  private spawn() {
    const kind = b.spawn.pattern[this.spawnIndex++ % b.spawn.pattern.length];
    for (let attempt = 0; attempt < 60; attempt++) {
      const edge = Math.floor(this.random() * 4),
        x = edge < 2 ? (edge === 0 ? 35 : 1165) : 35 + this.random() * 1130,
        y = edge >= 2 ? (edge === 2 ? 35 : 685) : 35 + this.random() * 650;
      if (
        !this.free(x, y, b[kind].radius) ||
        distance({ x, y }, this.player) < b.spawn.minimumDistance ||
        this.enemies.some((e) => distance(e, { x, y }) < 60)
      )
        continue;
      this.enemies.push({
        id: this.nextId++,
        kind,
        x,
        y,
        angle: Math.atan2(this.player.y - y, this.player.x - x),
        hp: b[kind].health,
        maxHp: b[kind].health,
        radius: b[kind].radius,
        cooldown: 1,
        hit: 0,
      });
      return;
    }
  }
  private effect(x: number, y: number, kind: Effect["kind"]) {
    const total = kind === "blast" ? 0.65 : 0.18;
    this.effects.push({ id: this.nextId++, x, y, kind, life: total, total });
  }
  private fire(ship: Ship, angle: number, count: number, friendly: boolean) {
    for (let n = 0; n < count; n++) {
      const offset = (n - (count - 1) / 2) * 17;
      const x =
          ship.x +
          Math.cos(angle) * (ship.radius + 8) -
          Math.sin(angle) * offset,
        y =
          ship.y +
          Math.sin(angle) * (ship.radius + 8) +
          Math.cos(angle) * offset;
      const stats = friendly ? b.shot : b.enemyShot;
      this.bullets.push({
        id: this.nextId++,
        x,
        y,
        vx: Math.cos(angle) * stats.speed,
        vy: Math.sin(angle) * stats.speed,
        life: stats.life,
        damage: stats.damage,
        friendly,
      });
      this.effect(x, y, "muzzle");
    }
  }
  private damage(ship: Ship, amount: number) {
    ship.hp = Math.max(0, ship.hp - amount);
    ship.hit = 0.15;
    this.effect(ship.x, ship.y, ship.hp === 0 ? "blast" : "hit");
  }
  private tick(dt: number) {
    this.elapsed = Math.min(this.config.duration, this.elapsed + dt);
    if (this.elapsed >= this.config.duration) {
      this.ended = "time";
      this.input.clear();
      return;
    }
    const p = this.player;
    p.angle = wrap(
      p.angle +
        ((this.input.has("right") ? 1 : 0) - (this.input.has("left") ? 1 : 0)) *
          b.player.turn *
          dt,
    );
    if (this.input.has("forward")) this.move(p, b.player.speed, dt);
    for (const weapon of ["front", "port", "starboard"] as const) {
      this.cooldowns[weapon] = Math.max(0, this.cooldowns[weapon] - dt);
      if (this.input.has(weapon) && this.cooldowns[weapon] === 0) {
        this.fire(
          p,
          p.angle +
            (weapon === "front"
              ? 0
              : weapon === "port"
                ? -Math.PI / 2
                : Math.PI / 2),
          weapon === "front" ? 1 : 3,
          true,
        );
        this.cooldowns[weapon] =
          weapon === "front" ? b.shot.frontCooldown : b.shot.sideCooldown;
      }
    }
    this.spawnClock += dt;
    while (this.spawnClock >= this.config.spawnInterval) {
      this.spawnClock -= this.config.spawnInterval;
      this.spawn();
    }
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const stats = e.kind === "chaser" ? b.chaser : b.shooter;
      let target = Math.atan2(p.y - e.y, p.x - e.x);
      const obstacle = islands.find(
        (i) =>
          distance(e, i) < i.radius + e.radius + 90 &&
          Math.abs(wrap(Math.atan2(i.y - e.y, i.x - e.x) - target)) < 0.9,
      );
      if (obstacle)
        target = Math.atan2(obstacle.y - e.y, obstacle.x - e.x) + Math.PI / 2;
      e.angle = wrap(
        e.angle +
          Math.max(
            -stats.turn * dt,
            Math.min(stats.turn * dt, wrap(target - e.angle)),
          ),
      );
      const d = distance(e, p);
      if (e.kind === "chaser" || d > b.shooter.range * 0.72 || obstacle)
        this.move(e, stats.speed, dt);
      e.cooldown -= dt;
      if (
        e.kind === "shooter" &&
        d < b.shooter.range &&
        e.cooldown <= 0 &&
        Math.abs(wrap(target - e.angle)) < 0.25
      ) {
        this.fire(e, e.angle, 1, false);
        e.cooldown = b.shooter.cooldown;
      }
      if (e.kind === "chaser" && d < e.radius + p.radius) {
        this.damage(e, e.hp);
        this.damage(p, b.chaser.damage);
      }
      if (p.hp === 0) {
        this.ended = "sunk";
        this.input.clear();
        return;
      }
    }
    this.bullets = this.bullets.filter((shot) => {
      if (this.ended) return true;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (shot.life <= 0 || !this.free(shot.x, shot.y, b.shot.radius))
        return false;
      const target = (shot.friendly ? this.enemies : [p]).find(
        (s) => s.hp > 0 && distance(s, shot) < s.radius + b.shot.radius,
      );
      if (!target) return true;
      this.damage(target, shot.damage);
      if (target.hp === 0) {
        if (shot.friendly) this.score++;
        else {
          this.ended = "sunk";
          this.input.clear();
        }
      }
      return false;
    });
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    for (const ship of [p, ...this.enemies])
      ship.hit = Math.max(0, ship.hit - dt);
    this.effects = this.effects.filter((e) => (e.life -= dt) > 0);
  }
}
