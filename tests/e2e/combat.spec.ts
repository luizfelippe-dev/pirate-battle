import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
test("history pagination, errors, and recovered reads", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Network scenarios", { exact: true }).click();
  await page
    .getByLabel("Simulated harbor connection")
    .selectOption("populated");
  await page
    .getByRole("button", { name: "Match History", exact: true })
    .click();
  await expect(page.getByText("Page 1 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 3")).toBeVisible();
  await page
    .getByLabel("Simulated harbor connection")
    .selectOption("history-error");
  await expect(page.getByRole("alert")).toBeVisible();
  await page
    .getByLabel("Simulated harbor connection")
    .selectOption("populated");
  await expect(page.getByText("Page 2 of 3")).toBeVisible();
});
test("completion updates both panels and repeated visits dispose the old arena", async ({
  page,
}) => {
  await start(page);
  await advance(page, 90);
  await expect(
    page.getByText("Voyage recorded in ranking and history."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Main Menu", exact: true }).click();
  await page
    .getByRole("button", { name: "Match History", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "You", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ranking", exact: true }).click();
  await expect(page.getByText("24 voyages")).toBeVisible();
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForFunction(() => !!window.__battle);
    await expect(page.locator("canvas")).toHaveCount(1);
    await page.getByRole("button", { name: /Pause/ }).click();
    await page.getByRole("button", { name: "Abandon to Main Menu" }).click();
    await expect(page.locator("canvas")).toHaveCount(0);
  }
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pirate:confirmed")!).length,
    ),
  ).toBe(1);
});
async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => !!window.__battle);
}
async function advance(page: Page, seconds: number) {
  await page.evaluate((s) => window.__battle!.advance(s), seconds);
}
test("asset errors offer a working retry before combat begins", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Network scenarios", { exact: true }).click();
  await page
    .getByLabel("Simulated harbor connection")
    .selectOption("asset-error-once");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not be loaded");
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Retry loading" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => !!window.__battle);
  expect(await page.evaluate(() => window.__battle!.sim.elapsed)).toBe(0);
});
test("keyboard movement respects island collision and arena boundary", async ({
  page,
}) => {
  await start(page);
  await page.keyboard.down("w");
  await advance(page, 3.2);
  await page.keyboard.up("w");
  expect(
    await page.evaluate(() => window.__battle!.sim.player.y),
  ).toBeGreaterThanOrEqual(23);
  expect(await page.evaluate(() => window.__battle!.sim.player.y)).toBeLessThan(
    25,
  );
  await page.getByRole("button", { name: /Pause/ }).click();
  await page.getByRole("button", { name: "Abandon to Main Menu" }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => !!window.__battle);
  const turn = await page.evaluate(() => {
    const p = window.__battle!.sim.player;
    return (p.angle - Math.atan2(245 - p.y, 370 - p.x)) / 2.8;
  });
  await page.keyboard.down("a");
  await advance(page, turn);
  await page.keyboard.up("a");
  await page.keyboard.down("w");
  await advance(page, 2);
  await page.keyboard.up("w");
  const p = await page.evaluate(() => window.__battle!.sim.player);
  expect(Math.hypot(p.x - 370, p.y - 245)).toBeGreaterThanOrEqual(93);
  expect(p.y).toBeGreaterThan(245);
});
test("front and both broadsides enforce cooldowns and real attacks score once", async ({
  page,
}) => {
  await start(page);
  await page.keyboard.down("Space");
  await advance(page, 0.01);
  expect(await page.evaluate(() => window.__battle!.sim.bullets.length)).toBe(
    1,
  );
  await advance(page, 0.1);
  expect(await page.evaluate(() => window.__battle!.sim.bullets.length)).toBe(
    1,
  );
  await page.keyboard.up("Space");
  await page.keyboard.down("q");
  await page.keyboard.down("e");
  await advance(page, 0.01);
  await page.keyboard.up("q");
  await page.keyboard.up("e");
  expect(await page.evaluate(() => window.__battle!.sim.bullets.length)).toBe(
    7,
  );
  await advance(page, 4);
  await page.keyboard.down("Space");
  for (let i = 0; i < 50; i++) {
    const data = await page.evaluate(() => {
      const s = window.__battle!.sim,
        e = s.enemies[0];
      return {
        score: s.score,
        delta: e
          ? Math.atan2(
              Math.sin(
                Math.atan2(e.y - s.player.y, e.x - s.player.x) - s.player.angle,
              ),
              Math.cos(
                Math.atan2(e.y - s.player.y, e.x - s.player.x) - s.player.angle,
              ),
            )
          : 0,
      };
    });
    if (data.score > 0) break;
    const key = data.delta > 0 ? "d" : "a";
    if (Math.abs(data.delta) > 0.025) {
      await page.keyboard.down(key);
      await advance(page, Math.min(0.1, Math.abs(data.delta) / 2.8));
      await page.keyboard.up(key);
    } else await advance(page, 0.1);
  }
  await page.keyboard.up("Space");
  expect(await page.evaluate(() => window.__battle!.sim.score)).toBe(1);
  await advance(page, 0.1);
  expect(await page.evaluate(() => window.__battle!.sim.score)).toBe(1);
});
test("both enemy types spawn, turn, approach and the shooter fires", async ({
  page,
}) => {
  await start(page);
  await advance(page, 3.9);
  expect(await page.evaluate(() => window.__battle!.sim.enemies.length)).toBe(
    0,
  );
  await advance(page, 0.2);
  expect(await page.evaluate(() => window.__battle!.sim.enemies[0].kind)).toBe(
    "chaser",
  );
  const first = await page.evaluate(() => ({
    ...window.__battle!.sim.enemies[0],
  }));
  await advance(page, 1);
  const next = await page.evaluate(() => ({
    ...window.__battle!.sim.enemies[0],
  }));
  expect(Math.hypot(first.x - next.x, first.y - next.y)).toBeGreaterThan(50);
  await advance(page, 3);
  expect(
    await page.evaluate(() =>
      window.__battle!.sim.enemies.some((e) => e.kind === "shooter"),
    ),
  ).toBe(true);
  let fired = false;
  for (let n = 0; n < 140; n++) {
    await advance(page, 0.1);
    fired = await page.evaluate(
      () => window.__battle?.sim.bullets.some((b) => !b.friendly) ?? false,
    );
    if (fired) break;
  }
  expect(fired).toBe(true);
});
test("a full voyage ends on time using only real controls and clock advancement", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Options/ }).click();
  await page.getByLabel("Game session time").fill("60");
  await page.getByRole("button", { name: "Save options" }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => !!window.__battle);
  await page.evaluate(() => {
    const course = [
      [1100, 630],
      [1140, 80],
      [650, 60],
      [80, 70],
      [65, 630],
      [600, 650],
    ];
    let waypoint = 0;
    const held = new Set<string>();
    const key = (code: string, active: boolean) => {
      if (active === held.has(code)) return;
      if (active) held.add(code);
      else held.delete(code);
      window.dispatchEvent(
        new KeyboardEvent(active ? "keydown" : "keyup", {
          code,
          bubbles: true,
        }),
      );
    };
    const battle = window.__battle!;
    for (let frame = 0; frame < 60 * 120 + 2 && !battle.sim.ended; frame++) {
      const p = battle.sim.player,
        target = course[waypoint];
      if (Math.hypot(p.x - target[0], p.y - target[1]) < 65)
        waypoint = (waypoint + 1) % course.length;
      const desired = Math.atan2(target[1] - p.y, target[0] - p.x),
        delta = Math.atan2(
          Math.sin(desired - p.angle),
          Math.cos(desired - p.angle),
        );
      key("KeyW", true);
      key("Space", true);
      key("KeyQ", true);
      key("KeyE", true);
      key("KeyD", delta > 0.05);
      key("KeyA", delta < -0.05);
      battle.advance(1 / 120);
    }
    for (const code of held) key(code, false);
  });
  await expect(page.getByText("You weathered the storm.")).toBeVisible();
  await expect(page.getByText("60 seconds at sea")).toBeVisible();
});
test("late ranking responses cannot replace a newly selected network state", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Network scenarios", { exact: true }).click();
  await page.getByLabel("Simulated harbor connection").selectOption("variable");
  await page.getByRole("button", { name: "Ranking", exact: true }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.getByLabel("Simulated harbor connection").selectOption("empty");
  await expect(
    page.getByText("No voyages here yet.", { exact: false }),
  ).toBeVisible();
  await page.waitForTimeout(1800);
  await expect(
    page.getByText("No voyages here yet.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: /Blackwater/ })).toHaveCount(0);
});
