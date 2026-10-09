import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "solid" | "outline" | "light" | "ghost-light" | "text";

const variants: Record<ButtonVariant, string> = {
  solid: "bg-midnight text-ivory hover:bg-navy",
  outline: "border border-ink/30 text-ink hover:border-ink hover:bg-ink hover:text-ivory",
  light: "bg-ivory text-midnight hover:bg-paper",
  "ghost-light": "border border-ivory/60 text-ivory hover:bg-ivory hover:text-midnight",
  text: "px-0 text-royal",
};

export function buttonClass(variant: ButtonVariant = "solid", className?: string) {
  return cn(
    "inline-flex min-h-12 items-center justify-center gap-2 px-7 text-[0.7rem] font-semibold tracking-[0.2em] uppercase transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-50 touch-active active:scale-[0.97]",
    variants[variant],
    className,
  );
}

export function ButtonLink({ href, children, variant = "solid", className }: { href: string; children: ReactNode; variant?: ButtonVariant; className?: string }) {
  const external = href.startsWith("http");
  if (external) {
    return (
      <a href={href} className={buttonClass(variant, className)} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  action,
  tone = "dark",
  as: Tag = "h2",
}: {
  eyebrow?: string | null;
  title?: string | null;
  subtitle?: string | null;
  align?: "center" | "left";
  action?: ReactNode;
  tone?: "dark" | "light";
  as?: "h1" | "h2";
}) {
  if (!eyebrow && !title) return null;
  return (
    <div className={cn("mb-10 flex flex-col gap-4 md:mb-14", align === "center" ? "items-center text-center" : "md:flex-row md:items-end md:justify-between")}>
      <div className={cn(align === "center" && "max-w-2xl")}>
        {eyebrow && <p className={cn("eyebrow mb-4", tone === "light" ? "text-sky" : "text-royal")}>{eyebrow}</p>}
        {title && <Tag className={cn("display text-display-sm", tone === "light" ? "text-ivory" : "text-midnight")}>{title}</Tag>}
        {subtitle && <p className={cn("mt-4 text-[0.95rem] leading-relaxed", tone === "light" ? "text-ivory/75" : "text-muted")}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[0.7rem] tracking-[0.12em] text-muted uppercase">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => (
          <li key={`${item.name}-${i}`} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className="text-line-strong">/</span>}
            {item.href && i < items.length - 1 ? (
              <Link href={item.href} className="link-underline hover:text-ink">{item.name}</Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className={cn(i === items.length - 1 && "text-ink")}>{item.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
