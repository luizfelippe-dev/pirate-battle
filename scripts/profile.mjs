import { chromium } from "@playwright/test";
import { startPreview } from "./preview-server.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";

const server = await startPreview(4173);
let browser;
try {
  browser = await chromium.launch({
    args:
      process.platform === "win32" ? ["--use-angle=d3d11", "--enable-gpu"] : [],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4173");
  await page.getByRole("button", { name: /Options/ }).click();
  await page.getByLabel("Game session time").fill("180");
  await page.getByLabel("Enemy spawn time").fill("6");
  await page.getByRole("button", { name: "Save options" }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => !!window.__profile);
  const gpu = await page.evaluate(() => {
    const canvas = document.createElement("canvas"),
      gl = canvas.getContext("webgl"),
      debug = gl?.getExtension("WEBGL_debug_renderer_info");
    return debug
      ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
      : "Unavailable";
  });
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
    const held = new Set();
    const key = (code, active) => {
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
    const steer = () => {
      if (!window.__profile) {
        for (const code of held) key(code, false);
        return;
      }
      const p = window.__profile.state(),
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
      requestAnimationFrame(steer);
    };
    steer();
  });
  console.log(
    "Profiling a real-time, 180-second voyage with keyboard-controlled steering.",
  );
  await page.waitForFunction(() => !!window.__lastProfile, null, {
    timeout: 240000,
  });
  const combat = await page.evaluate(() => window.__lastProfile);
  await mkdir("docs/evidence", { recursive: true });
  await page.screenshot({
    path: "docs/evidence/profile-result.png",
    fullPage: true,
  });
  const cdp = await page.context().newCDPSession(page),
    memory = [];
  await cdp.send("Performance.enable");
  await page.getByRole("button", { name: "Main Menu", exact: true }).click();
  for (let cycle = 0; cycle < 6; cycle++) {
    if (cycle) {
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await page.waitForFunction(() => !!window.__profile);
      await page.waitForTimeout(3000);
      await page.getByRole("button", { name: /Pause/ }).click();
      await page.getByRole("button", { name: "Abandon to Main Menu" }).click();
    }
    await cdp.send("HeapProfiler.collectGarbage");
    const metrics = await cdp.send("Performance.getMetrics");
    memory.push({
      cycle,
      ...Object.fromEntries(
        metrics.metrics
          .filter((m) =>
            [
              "JSHeapUsedSize",
              "Nodes",
              "JSEventListeners",
              "Documents",
            ].includes(m.name),
          )
          .map((m) => [m.name, m.value]),
      ),
      canvases: await page.locator("canvas").count(),
    });
  }
  const report = {
    date: new Date().toISOString(),
    environment: {
      os: os.type() + " " + os.release(),
      cpu: os.cpus()[0].model,
      logicalCores: os.cpus().length,
      ramGiB: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
      browser: browser.version(),
      gpu,
      viewport: "1280 × 800",
      dpr: 1,
      headless: true,
    },
    config: { duration: 180, spawnInterval: 6, seed: 7321, sound: false },
    combat,
    memory,
    errors,
  };
  await writeFile(
    "docs/evidence/profile.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server.stop();
}
