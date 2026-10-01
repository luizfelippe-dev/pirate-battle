import { chromium, devices, expect } from "@playwright/test";

const url =
  process.argv[2] ?? "https://luizfelippe-dev.github.io/pirate-battle/";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Observe real media playback without replacing decoding or autoplay policy.
  await page.addInitScript(() => {
    window.mediaCheck = { started: [], failed: [], elements: [] };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!window.mediaCheck.elements.includes(this))
        window.mediaCheck.elements.push(this);
      const source = this.src;
      const result = play.call(this);
      void result.then(
        () => window.mediaCheck.started.push(source),
        (error) => window.mediaCheck.failed.push(error.name),
      );
      return result;
    };
  });
  await page.goto(url);
  await page.getByRole("button", { name: "Sound off", exact: true }).tap();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sound on", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Play", exact: true }).tap();
  await expect(page.locator("canvas")).toBeVisible();
  expect(
    await page.evaluate(() => "__battle" in window || "__profile" in window),
  ).toBe(false);

  const viewports = [
    { width: 393, height: 727 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const selector of [
      "canvas",
      ".battle-hud",
      ".helm-controls",
      ".weapon-controls",
    ]) {
      const locator = page.locator(selector);
      await expect(locator).toBeVisible();
      await expect
        .poll(async () => {
          const box = await locator.boundingBox();
          return (
            box &&
            box.x >= 0 &&
            box.y >= 0 &&
            box.x + box.width <= viewport.width + 1 &&
            box.y + box.height <= viewport.height + 1
          );
        })
        .toBeTruthy();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
  }

  const cdp = await context.newCDPSession(page);
  const touchPoints = [];
  for (const name of ["Sail forward", "Front cannon"]) {
    const box = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    touchPoints.push({
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
      id: touchPoints.length,
    });
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints,
  });
  await expect
    .poll(() => page.evaluate(() => window.mediaCheck.started.length))
    .toBeGreaterThan(0);
  await expect(
    page.locator('[data-action="front"] .reload-track > span'),
  ).not.toHaveAttribute("style", "transform: scaleX(1);");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const playback = await page.evaluate(() => ({
    started: window.mediaCheck.started,
    failed: window.mediaCheck.failed,
  }));
  expect(playback.failed).toEqual([]);
  expect(
    playback.started.some((source) => source.endsWith("cannon_fire_1.wav")),
  ).toBe(true);

  await page.getByRole("button", { name: /Pause/ }).tap();
  const pausedTime = await page.getByTestId("time").textContent();
  await page.waitForTimeout(1100);
  await expect(page.getByTestId("time")).toHaveText(pausedTime);
  await page.getByRole("button", { name: "Resume voyage" }).tap();
  await expect(page.getByTestId("time")).not.toHaveText(pausedTime);
  await page.getByRole("button", { name: /Pause/ }).tap();
  await page.getByRole("button", { name: "Abandon to Main Menu" }).tap();
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.mediaCheck.elements.every(
        (element) => element.paused && element.getAttribute("src") === "",
      ),
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Sound on", exact: true }).tap();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sound off", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Play", exact: true }).tap();
  await expect(page.locator("canvas")).toBeVisible();
  await page.keyboard.down("Space");
  await page.waitForTimeout(700);
  await page.keyboard.up("Space");
  expect(await page.evaluate(() => window.mediaCheck.elements.length)).toBe(0);
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      url,
      date: new Date().toISOString(),
      status: "passed",
      browser: browser.version(),
      device: "Pixel 7 emulation",
      viewports,
      checks: [
        "arena, HUD and controls fit all viewports",
        "no horizontal overflow",
        "simultaneous touch inputs",
        "cannon cooldown feedback",
        "real audio playback promise resolved",
        "sound preference persists on/off",
        "muted combat does not start audio",
        "pause freezes active time",
        "resume advances clock",
        "audio disposal",
        "no test hooks",
      ],
      audio: playback,
      errors,
      limitations: [
        "Emulation only; physical multitouch and audible speaker output are not verified.",
      ],
    }),
  );
} finally {
  await browser.close();
}
