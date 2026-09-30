import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

const advance = (page: Page, seconds: number) =>
  page.evaluate((s) => window.__battle!.advance(s), seconds);
async function start(page: Page) {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => !!window.__battle);
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("WASD and arrow keys include reverse and release aliases independently", async ({
  page,
}) => {
  await start(page);
  await page.keyboard.down("s");
  await advance(page, 0.3);
  await page.keyboard.down("ArrowDown");
  await page.keyboard.up("s");
  await advance(page, 0.2);
  await page.keyboard.up("ArrowDown");
  expect(await page.evaluate(() => window.__battle!.sim.player.y)).toBeCloseTo(
    605,
  );
  await page.keyboard.down("ArrowUp");
  await advance(page, 0.3);
  await page.keyboard.up("ArrowUp");
  expect(await page.evaluate(() => window.__battle!.sim.player.y)).toBeLessThan(
    550,
  );
  await page.keyboard.down("ArrowLeft");
  await advance(page, 0.2);
  await page.keyboard.up("ArrowLeft");
  expect(
    await page.evaluate(() => window.__battle!.sim.player.angle),
  ).toBeLessThan(-Math.PI / 2);
});

test("optional mouse fire persists and combines safely with keyboard weapons", async ({
  page,
}) => {
  await start(page);
  const arena = page.locator("canvas");
  await arena.hover();
  await page.mouse.down();
  await advance(page, 0.1);
  await page.mouse.up();
  expect(await page.evaluate(() => window.__battle!.sim.bullets.length)).toBe(
    0,
  );
  await page.getByRole("button", { name: /Pause/ }).click();
  await page.getByRole("button", { name: "Abandon to Main Menu" }).click();
  await page.getByRole("button", { name: /Options/ }).click();
  await page.getByLabel("Mouse firing", { exact: true }).check();
  await page.getByRole("button", { name: "Save options" }).click();
  await page.reload();
  await page.getByRole("button", { name: /Options/ }).click();
  await expect(page.getByLabel("Mouse firing", { exact: true })).toBeChecked();
  await page.getByLabel("Mouse firing", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: /Options/ }).click();
  await expect(page.getByLabel("Mouse firing", { exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await start(page);
  await arena.hover();
  await page.mouse.down();
  await page.keyboard.down("Space");
  await advance(page, 0.1);
  expect(await page.evaluate(() => window.__battle!.sim.bullets.length)).toBe(
    1,
  );
  await page.mouse.up();
  expect(
    await page.evaluate(() => window.__battle!.sim.input.has("front")),
  ).toBe(true);
  await page.keyboard.up("Space");
  await advance(page, 1.8);
  await page.mouse.down({ button: "right" });
  await advance(page, 0.11);
  expect(await page.evaluate(() => window.__battle!.sim.bullets.length)).toBe(
    6,
  );
  expect(
    await page.evaluate(() => window.__battle!.sim.weaponReadiness().port),
  ).toBeLessThan(0.2);
  await page.mouse.up({ button: "right" });
  await page.mouse.down();
  await page.keyboard.press("p");
  await page.mouse.up();
  await page.getByRole("button", { name: "Resume voyage" }).click();
  expect(await page.evaluate(() => window.__battle!.sim.input.size)).toBe(0);
});

test("two touches sail and fire together and controls fit after rotation", async ({
  page,
}) => {
  await start(page);
  const forward = await page
    .getByRole("button", { name: "Sail forward", exact: true })
    .boundingBox();
  const cannon = await page
    .getByRole("button", { name: "Front cannon", exact: true })
    .boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [forward!, cannon!].map((r, id) => ({
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
      id,
    })),
  });
  await advance(page, 0.3);
  const moved = await page.evaluate(() => window.__battle!.sim.player.y);
  expect(moved).toBeLessThan(550);
  expect(
    await page.evaluate(() => window.__battle!.sim.bullets.length),
  ).toBeGreaterThan(0);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await advance(page, 0.3);
  expect(await page.evaluate(() => window.__battle!.sim.player.y)).toBe(moved);
  expect(await page.evaluate(() => window.__battle!.sim.input.size)).toBe(0);
  await page.setViewportSize({ width: 844, height: 390 });
  for (const locator of [
    page.locator("canvas"),
    page.locator(".battle-hud"),
    page.locator(".helm-controls"),
    page.locator(".weapon-controls"),
  ]) {
    await expect(locator).toBeVisible();
    const bounds = (await locator.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(845);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(391);
  }
});
