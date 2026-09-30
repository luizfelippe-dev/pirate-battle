import { test as base, expect } from "@playwright/test";
export const test = base.extend<{ verifyRuntime: void }>({
  verifyRuntime: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await use();
      expect(errors, "Unhandled browser errors").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
