import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Automated WCAG 2.2 A/AA checks on key storefront templates (manual review is still required). */
const PAGES = ["/", "/shop/women/lehengas", "/products/neelam-midnight-silk-lehenga-set", "/collections", "/bag", "/contact", "/admin/login"];

for (const path of PAGES) {
  test(`no serious accessibility violations on ${path} @mobile`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("gnd-consent", "denied"));
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
}

test("no horizontal overflow at 360px @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  for (const path of ["/", "/shop/women", "/products/neelam-midnight-silk-lehenga-set", "/bag"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
