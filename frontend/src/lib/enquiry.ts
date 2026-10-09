"use client";

import { attributionPayload, track } from "./analytics";
import { apiFetch } from "./api-client";
import type { EnquiryResult } from "./types";

export type EnquiryItemInput = {
  product_id: number;
  variant_id?: number | null;
  color_value_id?: number | null;
  custom_size?: boolean;
  quantity: number;
};

export type EnquiryInput = {
  type: "product" | "bag" | "consultation" | "contact";
  items?: EnquiryItemInput[];
  customer?: { name?: string; phone?: string; email?: string; city?: string; country?: string; message?: string; marketing_consent?: boolean };
  privacy_consent?: boolean;
  measurements?: Record<string, string>;
  fitting_consultation?: boolean;
  preferred_date?: string;
};

/**
 * Save the enquiry intent first (server validates product, variant, availability and price),
 * then hand the visitor to WhatsApp. The returned status is "initiated": opening WhatsApp
 * does not prove a message was sent.
 */
export async function submitEnquiry(input: EnquiryInput): Promise<EnquiryResult> {
  const result = await apiFetch<{ data: EnquiryResult }>("/enquiries", {
    method: "POST",
    body: {
      ...input,
      source_path: window.location.pathname,
      ...attributionPayload(),
    },
  });

  for (const item of input.items ?? []) {
    track("whatsapp_enquiry_initiated", { product_id: item.product_id, enquiry_type: input.type }, { serverRecorded: true });
  }
  return result.data;
}

/** Record the redirect and navigate to WhatsApp in the same tab (reliable on mobile, no popup blockers). */
export function openWhatsApp(result: EnquiryResult): boolean {
  if (!result.whatsapp_url) return false;
  const body = new Blob([JSON.stringify({ token: result.summary_token })], { type: "application/json" });
  const url = `/backend/api/v1/enquiries/${encodeURIComponent(result.reference)}/redirected`;
  if (!navigator.sendBeacon?.(url, body)) {
    fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json", Accept: "application/json" } }).catch(() => undefined);
  }
  window.location.assign(result.whatsapp_url);
  return true;
}
