"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { useEffect, useState } from "react";
import { captureAttribution, getConsent, setConsent, track, type Consent } from "@/lib/analytics";

/**
 * A small, non-blocking consent notice (no modal, no dark patterns: equal-weight choices).
 * GA4 loads only after consent, and only when a measurement ID is configured in admin settings.
 */
export function ConsentAndAnalytics({ ga4Id }: { ga4Id: string | null }) {
  const [consent, setLocalConsent] = useState<Consent | null | "unknown">("unknown");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading persisted consent after mount
    setLocalConsent(getConsent());
    captureAttribution();
    const onChange = (e: Event) => setLocalConsent((e as CustomEvent<Consent>).detail);
    window.addEventListener("gnd:consent", onChange);
    return () => window.removeEventListener("gnd:consent", onChange);
  }, []);

  useEffect(() => {
    if (consent === "granted") track("page_view", { page_path: pathname });
  }, [pathname, searchParams, consent]);

  return (
    <>
      {consent === "granted" && ga4Id && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});gtag('config',${JSON.stringify(ga4Id)},{send_page_view:false,anonymize_ip:true});`}
          </Script>
        </>
      )}

      {consent === null && (
        <div role="region" aria-label="Cookie preferences" className="fixed inset-x-3 bottom-3 z-30 mx-auto max-w-xl border border-line bg-paper/98 p-5 shadow-[var(--shadow-lift)] sm:inset-x-auto sm:right-5 sm:bottom-5">
          <p className="text-sm leading-relaxed text-ink">
            We use optional measurement cookies to understand how our collections are discovered. No personal details are shared.{" "}
            <Link href="/pages/privacy-policy" className="text-royal underline underline-offset-4">Privacy policy</Link>
          </p>
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => setConsent("denied")} className="min-h-11 flex-1 border border-ink/30 px-4 text-[0.7rem] font-semibold tracking-[0.16em] uppercase">
              Decline
            </button>
            <button type="button" onClick={() => setConsent("granted")} className="min-h-11 flex-1 bg-midnight px-4 text-[0.7rem] font-semibold tracking-[0.16em] text-ivory uppercase">
              Accept
            </button>
          </div>
        </div>
      )}
    </>
  );
}
