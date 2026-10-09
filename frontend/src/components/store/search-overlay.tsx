"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { MediaImage } from "@/components/media/media-image";
import { track } from "@/lib/analytics";
import type { SearchSuggestions } from "@/lib/types";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export function SearchOverlay({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchSuggestions | null>(null);
  const [loading, setLoading] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const listId = useId();

  // Debounced suggestions.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const timer = setTimeout(async () => {
      abort.current?.abort();
      abort.current = new AbortController();
      setLoading(true);
      try {
        const res = await fetch(`/backend/api/v1/search/suggest?q=${encodeURIComponent(term)}`, {
          headers: { Accept: "application/json" },
          signal: abort.current.signal,
        });
        if (res.ok) setResults((await res.json()).data);
      } catch {
        /* aborted or offline */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 2) return;
    track("search", { search_term: term });
    onOpenChange(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  const visible = query.trim().length >= 2 ? results : null;
  const empty = visible && !visible.products.length && !visible.categories.length && !visible.collections.length;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-midnight/45 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed inset-x-0 top-0 z-50 max-h-[92dvh] overflow-y-auto bg-ivory shadow-[var(--shadow-lift)] focus:outline-none data-[state=open]:animate-fade-in">
          <Dialog.Title className="sr-only">Search the collection</Dialog.Title>
          <Dialog.Description className="sr-only">Type at least two characters to see suggestions.</Dialog.Description>
          <div className="container-editorial py-6 sm:py-10">
            <form onSubmit={submit} role="search" className="flex items-center gap-4 border-b border-ink/30 pb-3">
              <Search className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.3} />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search lehengas, sarees, sherwanis…"
                aria-label="Search"
                aria-controls={listId}
                aria-autocomplete="list"
                maxLength={100}
                className="display min-w-0 flex-1 bg-transparent text-2xl placeholder:text-muted/60 focus:outline-none sm:text-4xl"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted" aria-label="Loading" />}
              <Dialog.Close className="inline-flex h-11 w-11 items-center justify-center" aria-label="Close search">
                <X className="h-5 w-5" strokeWidth={1.4} />
              </Dialog.Close>
            </form>

            <div id={listId} aria-live="polite" className="pt-8">
              {!visible && (
                <div className="flex flex-wrap gap-2">
                  <span className="eyebrow mr-2 self-center text-muted">Popular</span>
                  {["Lehenga", "Saree", "Sherwani", "Bridal", "Organza", "Reception"].map((term) => (
                    <button key={term} type="button" onClick={() => setQuery(term)} className="border border-line px-4 py-2 text-sm transition-colors hover:border-ink">
                      {term}
                    </button>
                  ))}
                </div>
              )}

              {visible?.corrected_query && (
                <p className="mb-6 text-sm text-muted">
                  Showing results for <em className="text-ink not-italic">“{visible.corrected_query}”</em>
                </p>
              )}

              {empty && (
                <p className="text-muted">
                  No matches for “{query}”. Try a broader term, or{" "}
                  <Link href="/shop" onClick={() => onOpenChange(false)} className="text-royal underline underline-offset-4">
                    browse everything
                  </Link>
                  .
                </p>
              )}

              {visible && !empty && (
                <div className="grid gap-10 lg:grid-cols-[1fr_2.2fr]">
                  <div className="space-y-8">
                    {visible.categories.length > 0 && (
                      <section>
                        <p className="eyebrow mb-3 text-muted">Categories</p>
                        <ul className="space-y-2">
                          {visible.categories.map((c) => (
                            <li key={c.url}>
                              <Link href={c.url} onClick={() => onOpenChange(false)} className="display text-xl hover:text-royal">
                                {c.label} <span className="text-sm text-muted">{c.context}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                    {visible.collections.length > 0 && (
                      <section>
                        <p className="eyebrow mb-3 text-muted">Collections</p>
                        <ul className="space-y-2">
                          {visible.collections.map((c) => (
                            <li key={c.url}>
                              <Link href={c.url} onClick={() => onOpenChange(false)} className="display text-xl hover:text-royal">
                                {c.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </div>
                  {visible.products.length > 0 && (
                    <section>
                      <p className="eyebrow mb-3 text-muted">Designs</p>
                      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                        {visible.products.map((p) => (
                          <li key={p.id}>
                            <Link href={p.url} onClick={() => onOpenChange(false)} className="group block">
                              <div className="relative aspect-[4/5] overflow-hidden bg-ice">
                                <MediaImage media={p.image} sizes="(min-width: 1024px) 18vw, 45vw" fill className="transition-transform duration-700 group-hover:scale-[1.03]" />
                              </div>
                              <p className="mt-2 text-sm leading-snug">{p.name}</p>
                              <p className="text-xs text-muted">{p.price_label}</p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <button type="submit" onClick={submit} className="mt-6 inline-flex items-center gap-2 text-[0.75rem] font-semibold tracking-[0.18em] text-royal uppercase">
                        View all results <ArrowRight className="h-4 w-4" strokeWidth={1.4} />
                      </button>
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
