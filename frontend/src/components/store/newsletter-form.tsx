"use client";

import { useId, useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function NewsletterForm({ source, tone = "light", consentText }: { source: string; tone?: "light" | "dark"; consentText?: string }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const dark = tone === "dark";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!consent) {
      setError("Please confirm you would like to receive our letters.");
      return;
    }
    setState("sending");
    try {
      await apiFetch("/newsletter", { method: "POST", body: { email, consent: true, source } });
      setState("done");
    } catch (e) {
      setError(e instanceof ApiRequestError ? (e.field("email") ?? e.message) : "Please try again.");
      setState("idle");
    }
  };

  if (state === "done") {
    return <p className={cn("text-sm", dark ? "text-ivory" : "text-ink")} role="status">Thank you — you are on the list.</p>;
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className={cn("flex border-b", dark ? "border-ivory/40" : "border-ink/40")}>
        <label htmlFor={`${id}-email`} className="sr-only">Email address</label>
        <input
          id={`${id}-email`}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className={cn("min-w-0 flex-1 bg-transparent py-3 text-sm focus:outline-none", dark ? "placeholder:text-ivory/50" : "placeholder:text-muted")}
        />
        <button type="submit" disabled={state === "sending"} className="px-2 text-[0.7rem] font-semibold tracking-[0.18em] uppercase disabled:opacity-50">
          {state === "sending" ? "…" : "Subscribe"}
        </button>
      </div>
      <label className={cn("flex items-start gap-2 text-xs leading-relaxed", dark ? "text-ivory/70" : "text-muted")}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-royal" />
        <span>{consentText ?? "I agree to receive occasional emails and can unsubscribe at any time."}</span>
      </label>
      {/* Honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {error && <p className={cn("text-xs", dark ? "text-sky" : "text-danger")} role="alert">{error}</p>}
    </form>
  );
}
