"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiRequestError } from "@/lib/api-client";
import { openWhatsApp, submitEnquiry } from "@/lib/enquiry";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    name: z.string().trim().min(2, "Please tell us your name.").max(150),
    phone: z.string().trim().max(32).regex(/^\+?[0-9\s\-()]{7,20}$/, "Enter a valid phone number, ideally with country code.").or(z.literal("")),
    email: z.email("Enter a valid email address.").or(z.literal("")),
    city: z.string().trim().max(120).optional(),
    message: z.string().trim().max(2000).optional(),
    preferred_date: z.string().optional(),
    privacy: z.literal(true, { error: "Please agree to the privacy notice." }),
    website: z.string().max(0).optional(),
  })
  .refine((v) => v.phone || v.email, { message: "Share a phone number or email so we can reply.", path: ["phone"] });

type Values = z.input<typeof schema>;

/** Contact and consultation requests. Both are stored as enquiries the team manages in the admin. */
export function ContactForm({ mode }: { mode: "contact" | "consultation" }) {
  const [done, setDone] = useState<{ reference: string; whatsapp: boolean } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { phone: "", email: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const result = await submitEnquiry({
        type: mode,
        privacy_consent: true,
        preferred_date: values.preferred_date || undefined,
        customer: { name: values.name, phone: values.phone || undefined, email: values.email || undefined, city: values.city || undefined, message: values.message || undefined },
      });
      setDone({ reference: result.reference, whatsapp: Boolean(result.whatsapp_url) });
      if (mode === "consultation" && result.whatsapp_url) openWhatsApp(result);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        for (const [key, messages] of Object.entries(error.errors)) {
          const field = key.replace("customer.", "") as keyof Values;
          if (["name", "phone", "email", "city", "message", "preferred_date"].includes(field)) setError(field, { message: messages[0] });
        }
        setServerError(error.message);
      } else {
        setServerError("Something went wrong. Please try again.");
      }
    }
  });

  if (done) {
    return (
      <div role="status" className="border border-line bg-paper p-8">
        <p className="display text-3xl text-midnight">Thank you</p>
        <p className="mt-3 text-muted">
          Your {mode === "consultation" ? "consultation request" : "message"} has been received (reference <strong className="text-ink">{done.reference}</strong>). Our team will be in touch shortly.
        </p>
      </div>
    );
  }

  const field = "h-12 w-full border border-line-strong bg-paper px-4 text-[0.95rem] focus:border-ink focus:outline-none";
  const label = "mb-2 block text-[0.7rem] font-semibold tracking-[0.16em] uppercase";
  const err = (name: keyof Values) => errors[name] && <p id={`${name}-error`} className="mt-1.5 text-sm text-danger">{String(errors[name]?.message)}</p>;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div>
        <label htmlFor="name" className={label}>Name</label>
        <input id="name" autoComplete="name" className={field} aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} {...register("name")} />
        {err("name")}
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className={label}>Phone / WhatsApp</label>
          <input id="phone" type="tel" autoComplete="tel" placeholder="+91" className={field} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "phone-error" : undefined} {...register("phone")} />
          {err("phone")}
        </div>
        <div>
          <label htmlFor="email" className={label}>Email</label>
          <input id="email" type="email" autoComplete="email" className={field} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} {...register("email")} />
          {err("email")}
        </div>
      </div>
      <div className={cn("grid gap-6", mode === "consultation" && "sm:grid-cols-2")}>
        <div>
          <label htmlFor="city" className={label}>City <span className="font-normal tracking-normal text-muted normal-case">(optional)</span></label>
          <input id="city" autoComplete="address-level2" className={field} {...register("city")} />
        </div>
        {mode === "consultation" && (
          <div>
            <label htmlFor="preferred_date" className={label}>Preferred date <span className="font-normal tracking-normal text-muted normal-case">(optional)</span></label>
            <input id="preferred_date" type="date" min={new Date().toISOString().slice(0, 10)} className={field} {...register("preferred_date")} />
            {err("preferred_date")}
          </div>
        )}
      </div>
      <div>
        <label htmlFor="message" className={label}>{mode === "consultation" ? "Occasion and what you are looking for" : "Message"}</label>
        <textarea id="message" rows={5} className={cn(field, "h-auto py-3")} {...register("message")} />
      </div>
      <input type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden {...register("website")} />
      <label className="flex items-start gap-3 text-sm leading-relaxed">
        <input type="checkbox" className="mt-1 accent-royal" {...register("privacy")} />
        <span>I agree that my details may be stored to respond to this request, as described in the <Link href="/pages/privacy-policy" className="text-royal underline">privacy policy</Link>.</span>
      </label>
      {err("privacy")}
      {serverError && <p role="alert" className="text-sm text-danger">{serverError}</p>}
      <button type="submit" disabled={isSubmitting} className="inline-flex min-h-14 items-center gap-2 bg-midnight px-10 text-[0.72rem] font-semibold tracking-[0.2em] text-ivory uppercase hover:bg-navy disabled:opacity-50">
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} {mode === "consultation" ? "Request consultation" : "Send message"}
      </button>
    </form>
  );
}
