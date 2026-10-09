import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/store/ui";
import type { EnquirySummary } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Enquiry summary", robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }> };

/**
 * Shareable enquiry summary used when a bag is too long for a WhatsApp link.
 * Shows catalogue details only — never customer information.
 */
export default async function EnquirySummaryPage({ params }: Props) {
  const { token } = await params;
  if (!/^[A-Za-z0-9]{40}$/.test(token)) notFound();

  const api = (process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8010").replace(/\/$/, "");
  const res = await fetch(`${api}/api/v1/enquiries/summary/${token}`, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) notFound();
  const summary: EnquirySummary = (await res.json()).data;

  return (
    <div className="container-editorial max-w-3xl pt-12 pb-24">
      <p className="eyebrow text-royal">Enquiry {summary.reference}</p>
      <h1 className="display mt-3 text-display-sm text-midnight">Your selected designs</h1>
      <p className="mt-2 text-sm text-muted">Started {formatDate(summary.created_at)}</p>
      <table className="mt-10 w-full text-left text-sm">
        <thead className="border-b border-ink/20 text-[0.68rem] tracking-[0.14em] uppercase">
          <tr><th className="py-3 pr-4 font-semibold">Design</th><th className="py-3 pr-4 font-semibold">Size / Colour</th><th className="py-3 pr-4 font-semibold">Qty</th><th className="py-3 font-semibold">Price</th></tr>
        </thead>
        <tbody>
          {summary.items.map((item, i) => (
            <tr key={i} className="border-b border-line align-top">
              <td className="py-4 pr-4">
                {item.url ? <Link href={item.url} className="display text-lg hover:text-royal">{item.product_name}</Link> : <span className="display text-lg">{item.product_name}</span>}
                <span className="block text-xs text-muted">Ref. {item.reference}</span>
              </td>
              <td className="py-4 pr-4">{[item.size, item.color].filter(Boolean).join(" · ") || "—"}</td>
              <td className="py-4 pr-4">{item.quantity}</td>
              <td className="py-4">{item.price_label ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {summary.display_total && <p className="mt-6 text-right text-sm">Displayed total: <strong>{summary.display_total}</strong> <span className="text-muted">(final pricing confirmed by our team)</span></p>}
      {summary.whatsapp_url && (
        <div className="mt-10"><ButtonLink href={summary.whatsapp_url}>Continue on WhatsApp</ButtonLink></div>
      )}
    </div>
  );
}
