import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures";
test("harbor and options expose labeled controls with readable contrast", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: /Options/ }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Options/ })).toBeFocused();
});
test("records, combat, pause and result retain accessible semantics", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ranking", exact: true }).click();
  await expect(page.getByText("Page 1 of 5")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("button", { name: "Match History", exact: true })
    .click();
  await expect(
    page.getByText("No voyages here yet.", { exact: false }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => !!window.__battle);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: /Pause/ }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Resume voyage" }).click();
  await page.evaluate(() => window.__battle!.advance(90));
  await expect(
    page.getByText("Voyage recorded in ranking and history."),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
