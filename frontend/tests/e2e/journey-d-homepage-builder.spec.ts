import { expect, test, type Page } from "@playwright/test";
import { adminLogin, API } from "./helpers";

/** Journey D: Admin reorders homepage sections → publishes → the live homepage updates. */
async function liveOrder(page: Page): Promise<string[]> {
  const res = await page.request.get(`${API}/homepage`);
  return (await res.json()).data.map((s: { type: string; data: { title?: string; headline?: string } }) => s.data.title ?? s.data.headline ?? s.type);
}

async function moveSection(page: Page, name: string, key: "ArrowUp" | "ArrowDown") {
  const handle = page.getByRole("button", { name: new RegExp(`^Reorder ${name} \\(position`) });
  const before = await handle.getAttribute("aria-label");
  await handle.focus();
  // dnd-kit's keyboard sensor needs the pick-up, move and drop as distinct steps.
  await page.keyboard.press("Space");
  await page.waitForTimeout(250);
  await page.keyboard.press(key);
  await page.waitForTimeout(250);
  await page.keyboard.press("Space");
  await expect(handle).not.toHaveAttribute("aria-label", before!);
}

async function publish(page: Page) {
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText(/Homepage published/)).toBeVisible();
}

test("Journey D — reordering and publishing homepage sections updates the storefront", async ({ page }) => {
  const before = await liveOrder(page);
  const index = before.indexOf("Bestsellers");
  test.skip(index < 1, "Seeded homepage with a Bestsellers section is required");

  await adminLogin(page);
  await page.goto("/admin/homepage");
  await expect(page.getByRole("button", { name: /^Reorder Bestsellers/ })).toBeVisible();
  // Never publish someone else's pending drafts: only run from a clean, fully published state.
  test.skip(await page.getByRole("button", { name: "Publish", exact: true }).isEnabled(), "Homepage has unpublished drafts");

  // Draft change is not live until published.
  await moveSection(page, "Bestsellers", "ArrowUp");
  expect(await liveOrder(page)).toEqual(before);

  await publish(page);
  const after = await liveOrder(page);
  expect(after.indexOf("Bestsellers")).toBe(index - 1);

  // The storefront renders the new order (publishing triggers on-demand revalidation of cached pages).
  const storefrontHeadings = async () => {
    const html = await (await page.request.get("/")).text();
    return [...html.matchAll(/<h2[^>]*>([^<]*)</g)].map((m) => m[1].replace(/&amp;/g, "&"));
  };
  await expect.poll(async () => {
    const h = await storefrontHeadings();
    return h.indexOf("Bestsellers") < h.indexOf(before[index - 1]);
  }, { timeout: 30_000 }).toBe(true);

  // Restore the original order so the journey is repeatable.
  await page.goto("/admin/homepage");
  await moveSection(page, "Bestsellers", "ArrowDown");
  await publish(page);
  expect(await liveOrder(page)).toEqual(before);
});
