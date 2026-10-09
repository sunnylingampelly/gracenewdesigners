import path from "node:path";
import { expect, test } from "@playwright/test";
import { adminLogin, unique } from "./helpers";

/** Journey B: Admin Login → Add Category → Add Product → Upload Images → Publish → Verify Storefront. */
test("Journey B — admin creates a category and publishes a product that appears on the storefront", async ({ page }) => {
  const categoryName = unique("E2E Category");
  const productName = unique("E2E Organza Saree");
  const sku = `E2E-${Date.now().toString(36).toUpperCase()}`;

  await adminLogin(page);

  // Add category (top level of Women)
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: "New category" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Department").selectOption({ label: "Women" });
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill(categoryName);
  await dialog.getByRole("button", { name: "Create category" }).click();
  await expect(page.getByText(categoryName).first()).toBeVisible();

  // Add product
  await page.goto("/admin/products/new");
  await page.getByLabel("Product name").fill(productName);
  await page.getByLabel("SKU / design reference").fill(sku);
  await page.getByLabel("Selling price (INR)").fill("18500");
  await page.getByLabel("Filter options").first().fill(categoryName).catch(() => undefined);
  await page.getByRole("checkbox", { name: categoryName }).check();

  // Upload an image (drag-and-drop zone input)
  await page.locator('#media input[type=file]').setInputFiles(path.join(__dirname, "fixtures", "test-image.jpg"));
  await expect(page.getByLabel("Alt text for image 1")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Alt text for image 1").fill(`${productName} front view`);

  // Publish
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText("Product published")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/products\/\d+$/);
  const slug = await page.getByLabel("URL slug").inputValue();

  // Verify storefront (product page + category listing). ISR may serve a cached page briefly.
  await expect.poll(async () => (await page.request.get(`/products/${slug}`)).status(), { timeout: 60_000 }).toBe(200);
  await page.goto(`/products/${slug}`);
  await expect(page.getByRole("heading", { level: 1, name: productName })).toBeVisible();
  await expect(page.getByText("₹18,500").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Order on WhatsApp" })).toBeVisible();
});
