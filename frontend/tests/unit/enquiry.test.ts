import { afterEach, describe, expect, it, vi } from "vitest";
import { setConsent } from "@/lib/analytics";
import { openWhatsApp, submitEnquiry } from "@/lib/enquiry";

describe("WhatsApp enquiry handoff", () => {
  afterEach(() => vi.restoreAllMocks());

  it("saves the enquiry first and sends no personal or attribution data without consent", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("csrf-cookie")) return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ data: { reference: "GND-ENQ-000001", status: "initiated", whatsapp_url: "https://wa.me/911234567890?text=x", message: "x", summary_url: "", summary_token: "t".repeat(40) } }), { status: 201 });
    });
    sessionStorage.setItem("gnd-utm", JSON.stringify({ source: "instagram" }));

    const result = await submitEnquiry({ type: "product", items: [{ product_id: 1, variant_id: 2, quantity: 1 }] });

    expect(result.reference).toBe("GND-ENQ-000001");
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes("/enquiries"))!;
    const body = JSON.parse(String((call[1] as RequestInit).body));
    expect(body.attribution_consent).toBe(false);
    expect(body.utm).toBeUndefined();
    expect(body.items).toEqual([{ product_id: 1, variant_id: 2, quantity: 1 }]);
  });

  it("includes UTM attribution only after analytics consent", async () => {
    setConsent("granted");
    sessionStorage.setItem("gnd-utm", JSON.stringify({ source: "instagram" }));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { reference: "R", whatsapp_url: null } }), { status: 201 }));

    await submitEnquiry({ type: "bag", items: [{ product_id: 1, quantity: 1 }] });
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes("/enquiries"))!;
    expect(JSON.parse(String((call[1] as RequestInit).body)).utm).toEqual({ source: "instagram" });
  });

  it("does not navigate when WhatsApp is not configured", () => {
    expect(openWhatsApp({ reference: "R", status: "initiated", whatsapp_url: null, message: "", summary_url: "", summary_token: "x" })).toBe(false);
  });
});
