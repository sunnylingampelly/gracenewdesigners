import { expect, test } from "@playwright/test";
import { adminLogin, captureEnquiry, captureWhatsApp, ensureWhatsAppNumber } from "./helpers";

/** Journey C: Visitor Enquiry → Admin Enquiry List → Update Lead → Confirm Order. */
test("Journey C — an enquiry is managed as a lead and converted into a confirmed order", async ({ page, browser }) => {
  // Visitor (separate context, no admin session)
  const admin = await browser.newPage();
  await adminLogin(admin);
  await ensureWhatsAppNumber(admin);

  const whatsapp = await captureWhatsApp(page);
  await page.goto("/products/aarohi-ivory-chikankari-kurta-set");
  await page.getByRole("radio", { name: /^Ivory/ }).click();
  const size = page.getByRole("radiogroup", { name: "Size" }).getByRole("radio").filter({ hasNotText: "Custom" }).and(page.locator(":not([disabled]):not([aria-label*=unavailable])")).first();
  await size.click();
  const enquiry = await captureEnquiry(page);
  await page.getByRole("button", { name: "Order on WhatsApp" }).click();
  await expect.poll(() => enquiry()?.status).toBe(201);
  const reference = enquiry()!.data.reference;
  await expect.poll(whatsapp).toContain("wa.me");

  // Admin enquiry list
  await admin.goto(`/admin/enquiries?q=${reference}`);
  await admin.getByText(reference).first().click();
  await expect(admin.getByRole("heading", { name: new RegExp(reference) })).toBeVisible();

  // Update lead
  await admin.getByLabel("Status", { exact: true }).selectOption("qualified");
  await admin.getByLabel("Status note").fill("Customer confirmed size on WhatsApp (E2E)");
  await admin.getByRole("button", { name: "Save changes" }).click();
  await expect(admin.getByText("Customer confirmed size on WhatsApp (E2E)").first()).toBeVisible();

  // Create and confirm the order
  await admin.getByRole("link", { name: "Create order" }).click();
  await expect(admin).toHaveURL(/\/admin\/orders\/new\?enquiry=/);
  await admin.getByLabel("Agreed unit price (₹)").first().fill("9500");
  await admin.getByRole("button", { name: "Save order" }).first().click();
  await expect(admin).toHaveURL(/\/admin\/orders\/\d+$/);

  await admin.getByLabel("Order status").selectOption("confirmed");
  await admin.getByRole("button", { name: "Update order" }).click();
  await admin.getByRole("button", { name: "Confirm & commit stock" }).click();
  await expect(admin.getByText("Confirmed").first()).toBeVisible();

  // The enquiry now reflects the confirmed order.
  await admin.goto(`/admin/enquiries?q=${reference}`);
  await expect(admin.getByText("Order Confirmed").first()).toBeVisible();
  await admin.close();
});
