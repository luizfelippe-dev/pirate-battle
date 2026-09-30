import { chromium } from "@playwright/test";
import { startPreview } from "./preview-server.mjs";
import { writeFile } from "node:fs/promises";
const server = await startPreview(4174);
let browser;
try {
  browser = await chromium.launch({
    args:
      process.platform === "win32" ? ["--use-angle=d3d11", "--enable-gpu"] : [],
  });
  const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    }),
    cdp = await page.context().newCDPSession(page),
    samples = [],
    heaps = [];
  const heapSummary = async () => {
    const chunks = [];
    const receive = (event) => chunks.push(event.chunk);
    cdp.on("HeapProfiler.addHeapSnapshotChunk", receive);
    await cdp.send("HeapProfiler.takeHeapSnapshot");
    cdp.off("HeapProfiler.addHeapSnapshotChunk", receive);
    const heap = JSON.parse(chunks.join("")),
      fields = heap.snapshot.meta.node_fields,
      types = heap.snapshot.meta.node_types[0],
      width = fields.length,
      counts = {};
    for (let i = 0; i < heap.nodes.length; i += width) {
      if (types[heap.nodes[i]] !== "object") continue;
      const name = heap.strings[heap.nodes[i + fields.indexOf("name")]];
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
  };
  await cdp.send("Performance.enable");
  await page.goto("http://127.0.0.1:4174");
  for (let cycle = 0; cycle < 25; cycle++) {
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForFunction(() => !!window.__profile);
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /Pause/ }).click();
    await page.getByRole("button", { name: "Abandon to Main Menu" }).click();
    await page.waitForTimeout(150);
    await cdp.send("HeapProfiler.collectGarbage");
    const metrics = await cdp.send("Performance.getMetrics");
    samples.push({
      cycle: cycle + 1,
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
    if (cycle === 4 || cycle === 24) heaps.push(await heapSummary());
  }
  const retainedObjectChanges = Object.entries(heaps[1])
    .map(([name, count]) => ({
      name,
      before: heaps[0][name] ?? 0,
      after: count,
      change: count - (heaps[0][name] ?? 0),
    }))
    .filter((row) => row.change !== 0)
    .sort((a, b) => b.change - a.change)
    .slice(0, 30);
  await writeFile(
    "docs/evidence/memory-extended.json",
    JSON.stringify(
      { date: new Date().toISOString(), samples, retainedObjectChanges },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      { first: samples[0], last: samples.at(-1), retainedObjectChanges },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  server.stop();
}
