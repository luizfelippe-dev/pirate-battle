import { chromium, expect } from "@playwright/test";
const url = process.argv[2] ?? "http://127.0.0.1:4173/pirate-battle/";
const browser = await chromium.launch({
  args:
    process.platform === "win32" ? ["--use-angle=d3d11", "--enable-gpu"] : [],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.getByRole("button", { name: "Ranking", exact: true }).click();
  await expect(page.getByText("Page 1 of 5")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId("time")).not.toHaveText("1:30");
  expect(
    await page.evaluate(() => "__battle" in window || "__profile" in window),
  ).toBe(false);
  await page.getByRole("button", { name: /Pause/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Resume voyage" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.keyboard.press("p");
  await page.getByRole("button", { name: "Abandon to Main Menu" }).click();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Match History", exact: true })
    .click();
  await expect(
    page.getByText("No voyages here yet.", { exact: false }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  if (process.argv.includes("--complete")) {
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(
      page.getByText("VOYAGE COMPLETE", { exact: true }),
    ).toBeVisible({ timeout: 120000 });
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
    await page.reload();
    await page.getByRole("button", { name: /Last voyage/ }).click();
    await expect(
      page.getByText("Voyage recorded in ranking and history."),
    ).toBeVisible();
    expect(errors).toEqual([]);
  }
  console.log(
    JSON.stringify({
      url,
      status: "passed",
      checks: [
        "ranking via MSW",
        "refresh",
        "real-time combat",
        "no test hooks",
        "pause/resume",
        "abandonment",
        "empty history",
      ],
      errors,
    }),
  );
} finally {
  await browser.close();
}
