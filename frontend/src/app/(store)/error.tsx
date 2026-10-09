"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="container-editorial flex min-h-[60svh] flex-col items-center justify-center py-24 text-center">
      <p className="eyebrow mb-4 text-royal">Something went wrong</p>
      <h1 className="display text-display-sm text-midnight">We couldn’t load this page just now</h1>
      <p className="mt-4 max-w-md text-muted">Please try again in a moment. If the problem continues, our team is happy to help on WhatsApp or by email.</p>
      <div className="mt-8 flex gap-3">
        <button type="button" onClick={reset} className="inline-flex min-h-12 items-center bg-midnight px-7 text-[0.7rem] font-semibold tracking-[0.2em] text-ivory uppercase">Try again</button>
        <Link href="/contact" className="inline-flex min-h-12 items-center border border-ink/30 px-7 text-[0.7rem] font-semibold tracking-[0.2em] uppercase">Contact us</Link>
      </div>
      {error.digest && <p className="mt-6 text-xs text-muted">Reference: {error.digest}</p>}
    </section>
  );
}
