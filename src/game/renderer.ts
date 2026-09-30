import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  type Texture,
} from "pixi.js";
import { ARENA, islands } from "./config";
import type { Simulation, Ship } from "./simulation";
import { basePath } from "../paths";
const paths = {
  player: "/assets/png/default/ships/ship_1.png",
  chaser: "/assets/png/default/ships/ship_3.png",
  shooter: "/assets/png/default/ships/ship_2.png",
  playerDamaged: "/assets/png/default/ships/ship_7.png",
  playerCritical: "/assets/png/default/ships/ship_13.png",
  chaserDamaged: "/assets/png/default/ships/ship_9.png",
  chaserCritical: "/assets/png/default/ships/ship_15.png",
  shooterDamaged: "/assets/png/default/ships/ship_8.png",
  shooterCritical: "/assets/png/default/ships/ship_14.png",
  blast: "/assets/png/default/effects/explosion_1.png",
  blast2: "/assets/png/default/effects/explosion_2.png",
  blast3: "/assets/png/default/effects/explosion_3.png",
};
export async function loadTextures(progress: (value: number) => void) {
  let done = 0;
  const entries = await Promise.all(
    Object.entries(paths).map(async ([key, path]) => {
      const texture = await Assets.load<Texture>(`${basePath}${path.slice(1)}`);
      progress(++done / Object.keys(paths).length);
      return [key, texture] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<keyof typeof paths, Texture>;
}
export class GameRenderer {
  readonly app = new Application();
  private scene = new Container();
  private ships = new Map<
    number,
    { root: Container; sprite: Sprite; health: Graphics }
  >();
  private bullets = new Graphics();
  private effects = new Graphics();
  private blasts = new Map<number, Sprite>();
  private water = new Graphics();
  private observer: ResizeObserver | null = null;
  async init(
    host: HTMLElement,
    privateTextures: Record<keyof typeof paths, Texture>,
  ) {
    this.textures = privateTextures;
    await this.app.init({
      background: "#237b8b",
      antialias: true,
      resolution: Math.min(devicePixelRatio, 2),
      autoDensity: true,
      preference: "webgl",
    });
    host.append(this.app.canvas);
    this.app.canvas.setAttribute("aria-label", "Naval battle arena");
    this.app.stage.addChild(this.scene);
    this.scene.addChild(this.water);
    this.drawWater();
    const land = new Graphics();
    for (const i of islands) {
      land
        .circle(i.x + 4, i.y + 7, i.radius + 13)
        .fill({ color: 0x175b69, alpha: 0.5 });
      land.circle(i.x, i.y, i.radius + 6).fill(0x79c5bd);
      land.circle(i.x, i.y, i.radius).fill(0xe4c78e);
      land.circle(i.x - 3, i.y - 5, i.radius - 12).fill(0x668b4d);
      land.circle(i.x - 12, i.y - 12, i.radius - 24).fill(0x7a9c59);
      for (let n = 0; n < 3; n++) {
        const x = i.x + (n - 1) * 24,
          y = i.y + (n % 2) * 23 - 14;
        land.circle(x + 3, y + 5, 16).fill({ color: 0x345f40, alpha: 0.4 });
        for (let k = 0; k < 5; k++) {
          const a = (k * Math.PI * 2) / 5;
          land
            .moveTo(x, y)
            .lineTo(x + Math.cos(a) * 24, y + Math.sin(a) * 24)
            .stroke({ width: 8, color: 0x365e3f });
        }
        land.circle(x, y, 6).fill(0xa18a51);
      }
    }
    this.scene.addChild(land, this.bullets, this.effects);
    const resize = () => {
      const w = host.clientWidth,
        h = host.clientHeight;
      this.app.renderer.resize(w, h);
      const s = Math.min(w / ARENA.width, h / ARENA.height);
      this.scene.scale.set(s);
      this.scene.position.set(
        (w - ARENA.width * s) / 2,
        (h - ARENA.height * s) / 2,
      );
    };
    this.observer = new ResizeObserver(resize);
    this.observer.observe(host);
    resize();
  }
  private textures!: Record<keyof typeof paths, Texture>;
  private drawWater() {
    this.water.rect(0, 0, 1200, 720).fill(0x237b8b);
    for (let y = 18; y < 720; y += 44)
      for (let x = 12; x < 1200; x += 65) {
        this.water
          .moveTo(x + (y % 3) * 8, y)
          .quadraticCurveTo(x + 12, y + 5, x + 25, y)
          .stroke({ color: 0x89d3d1, alpha: 0.19, width: 2 });
      }
    this.water
      .rect(2, 2, 1196, 716)
      .stroke({ color: 0xb5dbca, alpha: 0.35, width: 3 });
  }
  private drawShip(ship: Ship) {
    let view = this.ships.get(ship.id);
    if (!view) {
      const root = new Container(),
        sprite = new Sprite(this.textures[ship.kind]),
        health = new Graphics();
      sprite.anchor.set(0.5);
      sprite.width = ship.kind === "player" ? 44 : 41;
      sprite.height = 70;
      root.addChild(sprite, health);
      this.scene.addChild(root);
      view = { root, sprite, health };
      this.ships.set(ship.id, view);
    }
    view.root.position.set(ship.x, ship.y);
    view.sprite.rotation = ship.angle - Math.PI / 2;
    const damage = ship.hp / ship.maxHp;
    const textureKey =
      `${ship.kind}${damage <= 0.33 ? "Critical" : damage <= 0.66 ? "Damaged" : ""}` as keyof typeof paths;
    view.sprite.texture = this.textures[textureKey];
    view.sprite.tint =
      ship.hit > 0
        ? 0xffb090
        : ship.hp < ship.maxHp * 0.4
          ? 0xa9907e
          : 0xffffff;
    view.health
      .clear()
      .roundRect(-23, -51, 46, 6, 3)
      .fill(0x17373b)
      .roundRect(-22, -50, (44 * ship.hp) / ship.maxHp, 4, 2)
      .fill(ship.kind === "player" ? 0xbede94 : 0xf6a07d);
    if (ship.hp < ship.maxHp * 0.5)
      view.health.circle(9, -6, 5).fill({ color: 0x45483f, alpha: 0.7 });
  }
  render(sim: Simulation) {
    for (const s of [sim.player, ...sim.enemies]) this.drawShip(s);
    const ids = new Set([0, ...sim.enemies.map((e) => e.id)]);
    for (const [id, view] of this.ships)
      if (!ids.has(id)) {
        view.root.destroy({ children: true, context: true });
        this.ships.delete(id);
      }
    this.bullets.clear();
    for (const s of sim.bullets) {
      this.bullets
        .circle(s.x + 2, s.y + 3, 5)
        .fill({ color: 0x0b3e47, alpha: 0.4 });
      this.bullets.circle(s.x, s.y, 4).fill(s.friendly ? 0xffe3a1 : 0xf38968);
    }
    this.effects.clear();
    const blastIds = new Set(
      sim.effects.filter((e) => e.kind === "blast").map((e) => e.id),
    );
    for (const [id, sprite] of this.blasts)
      if (!blastIds.has(id)) {
        sprite.destroy();
        this.blasts.delete(id);
      }
    for (const e of sim.effects) {
      const t = 1 - e.life / e.total,
        r = e.kind === "blast" ? 12 + t * 38 : 4 + t * 14;
      if (e.kind === "blast") {
        let sprite = this.blasts.get(e.id);
        if (!sprite) {
          sprite = new Sprite(this.textures.blast);
          sprite.anchor.set(0.5);
          sprite.position.set(e.x, e.y);
          this.scene.addChild(sprite);
          this.blasts.set(e.id, sprite);
        }
        sprite.texture =
          this.textures[t < 0.33 ? "blast" : t < 0.66 ? "blast2" : "blast3"];
        sprite.width = sprite.height = 50 + t * 65;
        sprite.alpha = 1 - t;
      }
      this.effects
        .circle(e.x, e.y, r)
        .fill({ color: e.kind === "hit" ? 0xff9b68 : 0xffd992, alpha: 1 - t });
      this.effects
        .circle(e.x, e.y, r * 1.4)
        .stroke({ color: 0xffe6b4, alpha: 1 - t, width: 3 });
    }
  }
  destroy() {
    this.observer?.disconnect();
    this.ships.clear();
    this.blasts.clear();
    this.app.destroy(true, {
      children: true,
      context: true,
      texture: false,
      textureSource: false,
    });
  }
}
