"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight, MessageCircle, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { NavItem, PublicSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavItem[];
  secondary: NavItem[];
  settings: PublicSettings;
};

/** Accessible drawer (focus-trapped dialog) with drill-down levels for nested menus. */
export function MobileNav({ open, onOpenChange, items, secondary, settings }: Props) {
  const [stack, setStack] = useState<NavItem[]>([]);
  const level = stack.at(-1);
  const list = level ? level.children : items;
  const close = () => onOpenChange(false);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) setStack([]);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-midnight/40 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[88vw] max-w-sm flex-col bg-ivory shadow-[var(--shadow-lift)] focus:outline-none data-[state=open]:animate-fade-in">
          <div className="flex h-16 items-center justify-between border-b border-line px-5">
            <Dialog.Title className="eyebrow text-muted">{level ? level.label : "Menu"}</Dialog.Title>
            <Dialog.Description className="sr-only">Site navigation</Dialog.Description>
            <Dialog.Close className="-mr-2 inline-flex h-11 w-11 items-center justify-center" aria-label="Close menu">
              <X className="h-5 w-5" strokeWidth={1.4} />
            </Dialog.Close>
          </div>

          <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-5 py-4">
            {level && (
              <button type="button" onClick={() => setStack((s) => s.slice(0, -1))} className="mb-3 py-2 text-[0.75rem] tracking-[0.15em] text-muted uppercase">
                ← Back
              </button>
            )}
            {level?.url && (
              <Link href={level.url} onClick={close} className="display mb-2 block border-b border-line py-3 text-2xl text-royal">
                Shop all {level.label}
              </Link>
            )}
            <ul>
              {groupItems(list).map(([heading, children]) => (
                <li key={heading ?? "root"} className={cn(heading && "mt-5")}>
                  {heading && <p className="eyebrow mb-1 text-muted">{heading}</p>}
                  <ul>
                    {children.map((item) => (
                      <li key={item.id}>
                        {item.children.length ? (
                          <button
                            type="button"
                            onClick={() => setStack((s) => [...s, item])}
                            className="flex min-h-12 w-full items-center justify-between border-b border-line/70 py-3 text-left"
                          >
                            <span className={cn(level ? "text-[1rem]" : "display text-[1.6rem]")}>{item.label}</span>
                            <ChevronRight className="h-4 w-4 text-muted" strokeWidth={1.4} />
                          </button>
                        ) : item.url ? (
                          <Link href={item.url} onClick={close} className={cn("flex min-h-12 items-center border-b border-line/70 py-3", level ? "text-[1rem]" : "display text-[1.6rem]")}>
                            {item.label}
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>

            {!level && (
              <ul className="mt-8 space-y-1">
                {[{ label: "Wishlist", url: "/wishlist" }, { label: "Enquiry Bag", url: "/bag" }, { label: "Contact", url: "/contact" }, ...secondary.map((s) => ({ label: s.label, url: s.url ?? "/" }))].map((link) => (
                  <li key={link.label}>
                    <Link href={link.url} onClick={close} className="flex min-h-11 items-center text-[0.85rem] tracking-[0.06em] text-muted">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </nav>

          {settings.whatsapp_available && settings.whatsapp_business_number && (
            <a
              href={`https://wa.me/${settings.whatsapp_business_number.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="m-5 flex min-h-12 items-center justify-center gap-2 bg-midnight text-[0.75rem] font-semibold tracking-[0.18em] text-ivory uppercase"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={1.4} /> Chat on WhatsApp
            </a>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function groupItems(items: NavItem[]): [string | null, NavItem[]][] {
  const groups = new Map<string | null, NavItem[]>();
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  return [...groups.entries()];
}
