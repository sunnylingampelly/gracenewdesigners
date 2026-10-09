/* eslint-disable @next/next/no-img-element -- admin-uploaded logos keep their original aspect ratio */
import Link from "next/link";
import type { Media } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  brandName: string;
  logo?: Media | null;
  mobileLogo?: Media | null;
  tone?: "dark" | "light";
  className?: string;
  /** Rendered height in px for uploaded logos (width follows the original aspect ratio). */
  height?: number;
};

/**
 * Brand mark. Uses the admin-managed logo when uploaded; until then a typographic placeholder
 * set in Cormorant Garamond stands in, so the real logo can be swapped in without code changes.
 */
export function Logo({ brandName, logo, mobileLogo, tone = "dark", className, height = 40 }: Props) {
  const color = tone === "light" ? "text-ivory" : "text-midnight";

  return (
    <Link href="/" className={cn("inline-flex items-center", color, className)} aria-label={`${brandName} — home`}>
      {logo ? (
        <>
          <img
            src={logo.url}
            alt=""
            height={height}
            width={logo.width && logo.height ? Math.round((logo.width / logo.height) * height) : undefined}
            className={cn("h-auto w-auto object-contain", mobileLogo && "hidden md:block")}
            style={{ maxHeight: height }}
          />
          {mobileLogo && (
            <img src={mobileLogo.url} alt="" className="h-auto w-auto object-contain md:hidden" style={{ maxHeight: height * 0.8 }} />
          )}
        </>
      ) : (
        <TypographicMark brandName={brandName} />
      )}
    </Link>
  );
}

function TypographicMark({ brandName }: { brandName: string }) {
  const [first, ...rest] = brandName.split(" ");
  return (
    <span className="flex flex-col items-center leading-none select-none">
      <span className="display text-[1.65rem] tracking-[0.32em] uppercase sm:text-[1.9rem]">{first}</span>
      {rest.length > 0 && <span className="mt-1 text-[0.55rem] font-semibold tracking-[0.42em] uppercase opacity-80 sm:text-[0.6rem]">{rest.join(" ")}</span>}
    </span>
  );
}
