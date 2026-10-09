import { expect, type Page } from "@playwright/test";

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "owner@example.com";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Grace-Local-Dev-2026!";
export const API = (process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8010").replace(/\/$/, "") + "/api/v1";

export async function adminLogin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Intercept the wa.me handoff so tests never leave the site; returns the captured URL. */
export async function captureWhatsApp(page: Page): Promise<() => string | null> {
  let captured: string | null = null;
  await page.route("https://wa.me/**", (route) => {
    captured = route.request().url();
    return route.fulfill({ status: 200, contentType: "text/html", body: "<title>WhatsApp (stubbed)</title>" });
  });
  return () => captured;
}

/** The demo seed has no WhatsApp number; journeys that need one configure a clearly fictional number. */
export async function ensureWhatsAppNumber(page: Page) {
  await page.request.get("/sanctum/csrf-cookie");
  const cookies = await page.context().cookies();
  const xsrf = decodeURIComponent(cookies.find((c) => c.name === "XSRF-TOKEN")?.value ?? "");
  const res = await page.request.patch("/backend/api/v1/admin/settings", {
    headers: { "X-XSRF-TOKEN": xsrf, Accept: "application/json", Referer: page.url() },
    data: { whatsapp_enabled: true, whatsapp_business_number: process.env.E2E_WHATSAPP_NUMBER ?? "+911234567890" },
  });
  expect(res.ok()).toBeTruthy();
}

export const unique = (prefix: string) => `${prefix} ${Date.now().toString(36).toUpperCase()}`;

/** Capture the enquiry API response before the page navigates away to WhatsApp. */
export async function captureEnquiry(page: Page): Promise<() => { status: number; data: { reference: string; status: string } } | null> {
  let captured: { status: number; data: { reference: string; status: string } } | null = null;
  await page.route("**/api/v1/enquiries", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    captured = { status: response.status(), data: (await response.json()).data };
    await route.fulfill({ response });
  });
  return () => captured;
}
