import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
async function start(page: Page) {
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => !!window.__battle);
}
async function advance(page: Page, seconds: number) {
  await page.evaluate((s) => window.__battle!.advance(s), seconds);
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
});
test("menu, options validation and persistence", async ({ page }) => {
  await page.getByRole("button", { name: /Options/ }).click();
  await page.getByLabel("Game session time").fill("20");
  await page.getByRole("button", { name: "Save options" }).click();
  await expect(page.getByRole("alert")).toContainText("60–180");
  await page.getByLabel("Game session time").fill("120");
  await page.getByLabel("Enemy spawn time").fill("3");
  await page.getByRole("button", { name: "Save options" }).click();
  await page.reload();
  await expect(page.getByText("120 SEC")).toBeVisible();
});
test("real controls move, rotate, fire and pause without time jumps", async ({
  page,
  isMobile,
}) => {
  await start(page);
  const before = await page.evaluate(() => window.__battle!.sim.player.y);
  if (isMobile) {
    await page
      .getByRole("button", { name: "Sail forward", exact: true })
      .dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch" });
  } else await page.keyboard.down("w");
  await advance(page, 0.4);
  if (isMobile)
    await page
      .getByRole("button", { name: "Sail forward", exact: true })
      .dispatchEvent("pointerup", { pointerId: 1 });
  else await page.keyboard.up("w");
  expect(await page.evaluate(() => window.__battle!.sim.player.y)).toBeLessThan(
    before,
  );
  await page.locator(".arena-frame").focus();
  await page.keyboard.down("d");
  await advance(page, 0.2);
  await page.keyboard.up("d");
  expect(
    await page.evaluate(() => window.__battle!.sim.player.angle),
  ).toBeGreaterThan(-Math.PI / 2);
  await page.keyboard.down("q");
  await advance(page, 0.01);
  await page.keyboard.up("q");
  expect(await page.evaluate(() => window.__battle!.sim.bullets.length)).toBe(
    3,
  );
  await page.getByRole("button", { name: /Pause/ }).click();
  const time = await page.evaluate(() => window.__battle!.sim.elapsed);
  await advance(page, 20);
  expect(await page.evaluate(() => window.__battle!.sim.elapsed)).toBe(time);
  await page.getByRole("button", { name: "Resume voyage" }).click();
  await advance(page, 0.1);
  expect(await page.evaluate(() => window.__battle!.sim.input.size)).toBe(0);
  const resumedY = await page.evaluate(() => window.__battle!.sim.player.y);
  await page.keyboard.down("w");
  await advance(page, 0.2);
  await page.keyboard.up("w");
  expect(await page.evaluate(() => window.__battle!.sim.player.y)).not.toBe(
    resumedY,
  );
});
test("blur requires explicit resume and abandonment creates no record", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Abandon to Main Menu" }).click();
  await page.getByRole("button", { name: "Match History" }).click();
  await expect(
    page.getByText("No voyages here yet.", { exact: false }),
  ).toBeVisible();
  await start(page);
  expect(await page.evaluate(() => window.__battle!.sim.elapsed)).toBe(0);
  expect(await page.evaluate(() => window.__battle!.sim.player.hp)).toBe(100);
});
test("ranking pagination and network errors stay independent from gameplay", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Ranking", exact: true }).click();
  await expect(page.getByText("Page 1 of 5")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 5")).toBeVisible();
  await page.getByText("Network scenarios", { exact: true }).click();
  await page
    .getByLabel("Simulated harbor connection")
    .selectOption("ranking-error");
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("Simulated harbor connection").selectOption("empty");
  await expect(
    page.getByText("No voyages here yet.", { exact: false }),
  ).toBeVisible();
  await start(page);
  await expect(page.locator("canvas")).toBeVisible();
});
test("death result persists and is registered once", async ({ page }) => {
  await start(page);
  await advance(page, 90);
  await expect(
    page.getByText("VOYAGE COMPLETE", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Voyage recorded in ranking and history."),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Last voyage/ }).click();
  await expect(
    page.getByText("VOYAGE COMPLETE", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pirate:confirmed")!).length,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "Play Again" }).click();
  await page.waitForFunction(() => !!window.__battle);
  expect(await page.evaluate(() => window.__battle!.sim.score)).toBe(0);
});
test("pending results survive refresh and recover after network outage", async ({
  page,
}) => {
  await page.getByText("Network scenarios", { exact: true }).click();
  await page.getByLabel("Simulated harbor connection").selectOption("offline");
  await start(page);
  await advance(page, 90);
  await expect(
    page.getByText("VOYAGE COMPLETE", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Retry registration" }),
  ).toBeVisible();
  await page.getByText("Network scenarios", { exact: true }).click();
  await page.getByLabel("Simulated harbor connection").selectOption("success");
  await page.getByRole("button", { name: "Retry registration" }).click();
  await expect(page.locator(".pending")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pirate:confirmed")!).length,
    ),
  ).toBe(1);
});
test("timeout after commit is recovered without duplicate records", async ({
  page,
}) => {
  await page.getByText("Network scenarios", { exact: true }).click();
  await page
    .getByLabel("Simulated harbor connection")
    .selectOption("timeout-after-save");
  await start(page);
  await advance(page, 90);
  await expect(
    page.getByText("Voyage recorded in ranking and history."),
  ).toBeVisible({ timeout: 15000 });
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pirate:confirmed")!).length,
    ),
  ).toBe(1);
});
test("visual baselines: harbor, stable arena and result", async ({
  page,
  isMobile,
}) => {
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("harbor.png", {
    fullPage: true,
    timeout: 15000,
  });
  if (isMobile) {
    // Chromium's full-page capture resets touch emulation in this Playwright build.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 1,
    });
  }
  await start(page);
  if (isMobile)
    await expect(page.locator(".helm-controls")).toHaveCSS("display", "grid");
  await expect(page).toHaveScreenshot("arena.png", { timeout: 15000 });
  await advance(page, 90);
  await expect(
    page.getByText("Voyage recorded in ranking and history."),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("result.png", {
    fullPage: true,
    timeout: 15000,
  });
});
