import { expect, test } from "@playwright/test";
import { adminLogin, API, captureEnquiry, captureWhatsApp, ensureWhatsAppNumber } from "./helpers";

/** Journey A: Homepage → Category → Product → Variant → WhatsApp handoff. */
test.describe("Journey A — storefront to WhatsApp @mobile", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await adminLogin(page);
    await ensureWhatsAppNumber(page);
    await page.close();
  });

  test("visitor selects a valid variant and is handed to WhatsApp with a saved enquiry", async ({ page, isMobile }) => {
    const whatsapp = await captureWhatsApp(page);

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Homepage → category (via the category grid)
    await page.getByRole("link", { name: /Lehengas/ }).first().click();
    await expect(page).toHaveURL(/\/shop\/women\/lehengas/);
    await expect(page.getByRole("heading", { level: 1, name: "Lehengas" })).toBeVisible();

    // Category → product
    await page.getByRole("link", { name: /Neelam Midnight Silk Lehenga Set/ }).first().click();
    await expect(page).toHaveURL(/\/products\/neelam-midnight-silk-lehenga-set/);
    const cta = page.getByRole("button", { name: "Order on WhatsApp" });

    // Without a size the enquiry is blocked client-side.
    await cta.click();
    await expect(page.getByText("Please choose a size.")).toBeVisible();

    // Variant selection: Midnight Blue / M.
    await page.getByRole("radio", { name: /^Midnight Blue/ }).click();
    await page.getByRole("radio", { name: "M", exact: true }).click();
    await expect(page.getByText(/Ref\. GND-LEH-001-M-MID/)).toBeVisible();

    const enquiry = await captureEnquiry(page);
    await cta.click();
    await expect.poll(() => enquiry()?.status).toBe(201);
    const { data } = enquiry()!;
    expect(data.reference).toMatch(/^GND-ENQ-\d{6}$/);
    expect(data.status).toBe("initiated");

    await expect.poll(whatsapp).toContain("https://wa.me/");
    const message = decodeURIComponent(new URL(whatsapp()!).searchParams.get("text") ?? "");
    expect(message).toContain("Product: Neelam Midnight Silk Lehenga Set");
    expect(message).toContain("Size: M");
    expect(message).toContain("Color: Midnight Blue");
    expect(message).toContain(`Enquiry Ref: ${data.reference}`);
    expect(message).not.toMatch(/@|\+91\s?9/); // no customer contact data in the URL
    test.info().annotations.push({ type: "viewport", description: isMobile ? "mobile" : "desktop" });
  });

  test("sold-out size/colour combinations cannot be enquired", async ({ page }) => {
    // Find a live product with a sold-out combination from the public API.
    const list = await (await page.request.get(`${API}/products?per_page=24`)).json();
    const details = await Promise.all(list.data.map(async (card: { slug: string }) => (await (await page.request.get(`${API}/products/${card.slug}`)).json()).data));
    let target: { slug: string; size: string; color: string } | null = null;
    for (const detail of details) {
      const card = detail;
      const sold = detail.variants.find((v: { is_enquirable: boolean; size_id: number | null; color_id: number | null }) => !v.is_enquirable && v.size_id && v.color_id);
      if (sold) {
        target = {
          slug: card.slug,
          size: detail.options.sizes.find((s: { id: number }) => s.id === sold.size_id).label,
          color: detail.options.colors.find((c: { id: number }) => c.id === sold.color_id).label,
        };
        break;
      }
    }
    test.skip(!target, "No sold-out combination in the current catalogue");

    let posted = false;
    page.on("request", (r) => r.url().includes("/api/v1/enquiries") && r.method() === "POST" && (posted = true));
    await page.goto(`/products/${target!.slug}`);
    await page.getByRole("radio", { name: new RegExp(`^${target!.color}`) }).click();
    await page.getByRole("radiogroup", { name: "Size" }).getByRole("radio", { name: `${target!.size} — currently unavailable` }).click();
    await page.getByRole("button", { name: /on WhatsApp/ }).click();
    await expect(page.getByText(/currently unavailable/i).first()).toBeVisible();
    expect(posted).toBe(false);
  });
});
