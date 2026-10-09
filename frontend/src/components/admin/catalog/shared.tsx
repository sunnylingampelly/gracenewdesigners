"use client";

/* eslint-disable @next/next/no-img-element -- admin thumbnails come straight from backend renditions */
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog, Field, Input, Textarea } from "@/components/admin/ui";
import { adminApi } from "@/lib/admin/hooks";
import { cn } from "@/lib/utils";
import { errorMessage } from "./form-utils";

/** Small square thumbnail used in taxonomy lists. */
export function Thumb({ url, className }: { url: string | null | undefined; className?: string }) {
  return (
    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-slate-400", className)}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <ImageIcon className="h-4 w-4" aria-hidden />}
    </div>
  );
}

/** Text input wired to a <Field> label with a generated id. */
export function TextField({ label, value, onChange, error, hint, required, placeholder, maxLength, type = "text", className, inputClassName }: {
  label: ReactNode; value: string; onChange: (v: string) => void; error?: string; hint?: ReactNode; required?: boolean; placeholder?: string; maxLength?: number; type?: string; className?: string; inputClassName?: string;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} invalid={!!error} required={required} placeholder={placeholder} maxLength={maxLength} className={inputClassName} />
    </Field>
  );
}

export function TextAreaField({ label, value, onChange, error, hint, rows = 3, maxLength, className }: { label: ReactNode; value: string; onChange: (v: string) => void; error?: string; hint?: ReactNode; rows?: number; maxLength?: number; className?: string }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} className={className}>
      <Textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} invalid={!!error} maxLength={maxLength} />
    </Field>
  );
}

export type SeoValue = { seo_title: string; seo_description: string };

/** SEO title/description pair with length hints (limits match the API: 255 / 500). */
export function SeoFields({ value, onChange, fieldError }: { value: SeoValue; onChange: (v: SeoValue) => void; fieldError: (name: string) => string | undefined }) {
  return (
    <fieldset className="space-y-4 rounded-md border border-slate-200 p-4">
      <legend className="px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Search engine listing</legend>
      <TextField label="SEO title" value={value.seo_title} onChange={(v) => onChange({ ...value, seo_title: v })} error={fieldError("seo_title")} maxLength={255} hint={`${value.seo_title.length}/60 recommended · leave blank to use the name`} />
      <TextAreaField label="SEO description" value={value.seo_description} onChange={(v) => onChange({ ...value, seo_description: v })} error={fieldError("seo_description")} maxLength={500} rows={2} hint={`${value.seo_description.length}/160 recommended`} />
    </fieldset>
  );
}

/**
 * Destructive confirm that keeps the dialog open and shows the API's refusal inline
 * (e.g. "This department still has categories…") instead of silently closing.
 */
export function useDeleteConfirm() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<{ title: string; description: ReactNode; path: string; invalidate: QueryKey[]; success: string; confirmLabel?: string; onDone?: () => void } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setState(null);
    setError(null);
  };

  const dialog = state ? (
    <ConfirmDialog
      open
      destructive
      onOpenChange={(o) => !o && close()}
      title={state.title}
      confirmLabel={state.confirmLabel ?? "Delete"}
      loading={loading}
      description={
        <span className="block space-y-2">
          <span className="block">{state.description}</span>
          {error && <span role="alert" className="block rounded-md border border-red-200 bg-red-50 p-2.5 text-red-800">{error}</span>}
        </span>
      }
      onConfirm={async () => {
        setLoading(true);
        setError(null);
        try {
          await adminApi.delete(state.path);
          for (const key of state.invalidate) await queryClient.invalidateQueries({ queryKey: key });
          toast.success(state.success);
          state.onDone?.();
          close();
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setLoading(false);
        }
      }}
    />
  ) : null;

  return { confirmDelete: (s: NonNullable<typeof state>) => { setError(null); setState(s); }, dialog };
}

/** Section heading inside long modal forms. */
export function FormSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-4", className)}>
      <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h3>
      {children}
    </section>
  );
}
