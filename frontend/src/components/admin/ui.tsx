"use client";

/**
 * Admin UI kit — a calm, functional interface deliberately separate from the storefront aesthetic.
 * Built on Radix primitives for accessibility (focus management, keyboard support).
 */
import * as AlertDialog from "@radix-ui/react-dialog";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { ChevronLeft, ChevronRight, Inbox, Loader2, X } from "lucide-react";
import Link from "next/link";
import { forwardRef, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// ---- Buttons --------------------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
type ButtonSize = "sm" | "md";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-800 shadow-sm",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 shadow-sm",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-red-700 text-white hover:bg-red-800 shadow-sm",
  link: "text-royal hover:underline px-0",
};

export function buttonStyles(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal",
    size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
    buttonVariants[variant],
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...props }, ref) {
  return (
    <button ref={ref} type={type} className={buttonStyles(variant, size, className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({ href, variant = "primary", size = "md", className, children }: { href: string; variant?: ButtonVariant; size?: ButtonSize; className?: string; children: ReactNode }) {
  return <Link href={href} className={buttonStyles(variant, size, className)}>{children}</Link>;
}

// ---- Form fields -----------------------------------------------------------------------------------

const control = "block w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-royal focus:ring-2 focus:ring-royal/20 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500 aria-[invalid=true]:border-red-500";

export function Field({ label, hint, error, required, children, className, htmlFor }: { label?: ReactNode; hint?: ReactNode; error?: string; required?: boolean; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
          {label}
          {required && <span className="ml-0.5 text-red-600" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-red-700" role="alert">{error}</p> : hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...props }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(control, "h-10", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} aria-invalid={invalid || undefined} className={cn(control, "py-2 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={cn(control, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  );
});

export function Checkbox({ label, description, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-slate-900" {...props} />
      <label htmlFor={id} className="text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </label>
    </div>
  );
}

export function Switch({ checked, onCheckedChange, label, description, disabled }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </label>
      <SwitchPrimitive.Root id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition-colors data-[state=checked]:bg-slate-900 disabled:opacity-50">
        <SwitchPrimitive.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
      </SwitchPrimitive.Root>
    </div>
  );
}

/** Comma/enter separated free-text tags. */
export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const next = draft.split(",").map((t) => t.trim()).filter(Boolean);
    if (next.length) onChange([...new Set([...value, ...next])]);
    setDraft("");
  };
  return (
    <div className={cn(control, "flex min-h-10 flex-wrap items-center gap-1.5 py-1.5")}>
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Remove ${tag}`}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        placeholder={value.length ? "" : placeholder}
        className="min-w-24 flex-1 bg-transparent text-sm focus:outline-none"
      />
    </div>
  );
}

/** Searchable checkbox list for many-to-many assignments (categories, collections, occasions). */
export function MultiCheck({ options, value, onChange, height = "max-h-56", searchable = true }: { options: { value: number; label: string; hint?: string; depth?: number }[]; value: number[]; onChange: (v: number[]) => void; height?: string; searchable?: boolean }) {
  const [query, setQuery] = useState("");
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="rounded-md border border-slate-300 bg-white shadow-sm">
      {searchable && options.length > 8 && (
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter…" className="w-full border-b border-slate-200 px-3 py-2 text-sm focus:outline-none" aria-label="Filter options" />
      )}
      <ul className={cn("overflow-y-auto p-1", height)}>
        {filtered.map((o) => {
          const checked = value.includes(o.value);
          return (
            <li key={o.value}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50" style={{ paddingLeft: `${0.5 + (o.depth ?? 0) * 1}rem` }}>
                <input type="checkbox" checked={checked} onChange={() => onChange(checked ? value.filter((v) => v !== o.value) : [...value, o.value])} className="h-4 w-4 accent-slate-900" />
                <span className="flex-1">{o.label}</span>
                {o.hint && <span className="text-xs text-slate-400">{o.hint}</span>}
              </label>
            </li>
          );
        })}
        {filtered.length === 0 && <li className="px-2 py-3 text-sm text-slate-500">No matches</li>}
      </ul>
    </div>
  );
}

// ---- Layout ---------------------------------------------------------------------------------------

export function PageHeader({ title, description, actions, breadcrumbs }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumbs?: { label: string; href?: string }[] }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {breadcrumbs && (
          <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
            {breadcrumbs.map((b, i) => (
              <span key={b.label} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                {b.href ? <Link href={b.href} className="hover:text-slate-800 hover:underline">{b.label}</Link> : <span>{b.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, description, actions, children, className, padded = true }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cn("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={cn(padded && "p-5")}>{children}</div>
    </section>
  );
}

const badgeTones = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
} as const;
export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone = "slate", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", badgeTones[tone], className)}>{children}</span>;
}

const STATUS_TONES: Record<string, BadgeTone> = {
  draft: "slate", scheduled: "violet", published: "green", archived: "amber", trashed: "red",
  new: "blue", contacted: "violet", awaiting_response: "amber", qualified: "violet", order_confirmed: "green", completed: "green", lost: "slate", spam: "red",
  pending_confirmation: "amber", confirmed: "blue", in_production: "violet", ready: "blue", dispatched: "violet", delivered: "green", cancelled: "red",
  unpaid: "amber", partially_paid: "blue", paid: "green", refunded: "slate",
  in_stock: "green", low_stock: "amber", made_to_order: "violet", out_of_stock: "red",
  processed: "green", pending: "amber", failed: "red", processing: "blue", queued: "slate",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "slate"}>{label ?? status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-500">{icon ?? <Inbox className="h-5 w-5" />}</div>
      <p className="font-medium text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500" role="status">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}…
    </div>
  );
}

export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      {message}
      {onRetry && <button type="button" onClick={onRetry} className="ml-3 font-medium underline">Retry</button>}
    </div>
  );
}

// ---- Table ----------------------------------------------------------------------------------------

export type Column<T> = { key: string; header: ReactNode; cell: (row: T) => ReactNode; className?: string; hideOnMobile?: boolean };

/**
 * Responsive data table: a real <table> from md upwards, stacked cards on small screens.
 */
export function DataTable<T>({
  columns, rows, rowKey, loading, empty, onRowClick, selectable, selected, onSelectedChange,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selected?: (string | number)[];
  onSelectedChange?: (keys: (string | number)[]) => void;
}) {
  const allKeys = (rows ?? []).map(rowKey);
  const allSelected = selectable && allKeys.length > 0 && allKeys.every((k) => selected?.includes(k));

  if (loading && !rows) {
    return (
      <div className="divide-y divide-slate-100" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 animate-pulse bg-slate-50/70" />)}
      </div>
    );
  }
  if (!rows?.length) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;

  const toggle = (key: string | number) => onSelectedChange?.(selected?.includes(key) ? selected.filter((k) => k !== key) : [...(selected ?? []), key]);

  return (
    <div className={cn("relative", loading && "opacity-60")}>
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium tracking-wide text-slate-500 uppercase">
          <tr>
            {selectable && (
              <th className="w-10 px-4 py-3">
                <input type="checkbox" aria-label="Select all" checked={!!allSelected} onChange={() => onSelectedChange?.(allSelected ? [] : allKeys)} className="h-4 w-4 accent-slate-900" />
              </th>
            )}
            {columns.map((c) => <th key={c.key} scope="col" className={cn("px-4 py-3 font-medium", c.className)}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const key = rowKey(row);
            return (
              <tr key={key} className={cn("bg-white", onRowClick && "cursor-pointer hover:bg-slate-50")} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {selectable && (
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label="Select row" checked={!!selected?.includes(key)} onChange={() => toggle(key)} className="h-4 w-4 accent-slate-900" />
                  </td>
                )}
                {columns.map((c) => <td key={c.key} className={cn("px-4 py-3 align-middle", c.className)}>{c.cell(row)}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((row) => {
          const key = rowKey(row);
          return (
            <li key={key} className={cn("flex gap-3 bg-white px-4 py-3", onRowClick && "active:bg-slate-50")} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {selectable && <input type="checkbox" aria-label="Select row" checked={!!selected?.includes(key)} onChange={() => toggle(key)} onClick={(e) => e.stopPropagation()} className="mt-1 h-4 w-4 accent-slate-900" />}
              <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {columns.filter((c) => !c.hideOnMobile).map((c) => (
                  <div key={c.key} className="contents">
                    <dt className="text-xs text-slate-500">{c.header}</dt>
                    <dd className="min-w-0">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Pagination({ page, lastPage, total, onPage }: { page: number; lastPage: number; total?: number; onPage: (p: number) => void }) {
  if (lastPage <= 1) return total !== undefined ? <p className="px-4 py-3 text-xs text-slate-500">{total} total</p> : null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
      <span className="text-xs text-slate-500">Page {page} of {lastPage}{total !== undefined && ` · ${total} total`}</span>
      <div className="flex gap-1">
        <Button variant="secondary" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="secondary" size="sm" onClick={() => onPage(page + 1)} disabled={page >= lastPage} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

// ---- Dialogs --------------------------------------------------------------------------------------

export function Modal({ open, onOpenChange, title, description, children, footer, size = "md" }: { open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-5xl" }[size];
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
        <AlertDialog.Content className={cn("fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-white shadow-xl focus:outline-none", width)}>
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              <AlertDialog.Title className="text-base font-semibold text-slate-900">{title}</AlertDialog.Title>
              {description ? <AlertDialog.Description className="mt-1 text-sm text-slate-500">{description}</AlertDialog.Description> : <AlertDialog.Description className="sr-only">Dialog</AlertDialog.Description>}
            </div>
            <AlertDialog.Close className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X className="h-4 w-4" /></AlertDialog.Close>
          </div>
          {children && <div className="overflow-y-auto px-5 py-4">{children}</div>}
          {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirm", destructive, loading, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: ReactNode; confirmLabel?: string; destructive?: boolean; loading?: boolean; onConfirm: () => void }) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={destructive ? "danger" : "primary"} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    />
  );
}

/** Small helper hook for "are you sure" flows. */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; description?: ReactNode; confirmLabel?: string; destructive?: boolean; action: () => Promise<unknown> | void } | null>(null);
  const [loading, setLoading] = useState(false);
  const dialog = state ? (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && setState(null)}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      destructive={state.destructive}
      loading={loading}
      onConfirm={async () => {
        setLoading(true);
        try {
          await state.action();
          setState(null);
        } finally {
          setLoading(false);
        }
      }}
    />
  ) : null;
  return { confirm: setState, dialog };
}

export function Tabs({ tabs, active, onChange }: { tabs: { value: string; label: ReactNode; count?: number }[]; active: string; onChange: (v: string) => void }) {
  return (
    <div role="tablist" className="scrollbar-none flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={active === t.value}
          onClick={() => onChange(t.value)}
          className={cn("-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors", active === t.value ? "border-slate-900 font-medium text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function KeyValue({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-slate-500">{k}</dt>
          <dd className="min-w-0 text-slate-900">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
