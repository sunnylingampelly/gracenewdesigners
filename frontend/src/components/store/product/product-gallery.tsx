"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MediaImage } from "@/components/media/media-image";
import type { Media } from "@/lib/types";
import { cn } from "@/lib/utils";

type Item = { id: number | string; media: Media; colorCode?: string | null };

/**
 * Desktop: thumbnail rail + large viewer with click-to-zoom lightbox.
 * Mobile: full-width swipeable carousel (scroll-snap) with position indicator.
 * `focusIndex` lets the purchase panel jump to a colour's imagery.
 */
export function ProductGallery({ items, name, focusIndex = 0 }: { items: Item[]; name: string; focusIndex?: number }) {
  const [index, setIndex] = useState(focusIndex);
  const [zoomOpen, setZoomOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with colour selection from the purchase panel
    setIndex(focusIndex);
    const el = scroller.current;
    if (el) el.scrollTo({ left: el.clientWidth * focusIndex, behavior: "smooth" });
  }, [focusIndex]);

  if (items.length === 0) {
    return <div className="aspect-[4/5] bg-ice" aria-label={`${name} — image coming soon`} />;
  }

  const go = (next: number) => {
    const bounded = (next + items.length) % items.length;
    setIndex(bounded);
    scroller.current?.scrollTo({ left: scroller.current.clientWidth * bounded, behavior: "smooth" });
  };

  return (
    <div className="lg:grid lg:grid-cols-[5rem_1fr] lg:gap-5">
      {/* Thumbnails (desktop) */}
      <ul className="hidden max-h-[calc(100svh-10rem)] flex-col gap-3 overflow-y-auto lg:flex" aria-label="Product images">
        {items.map((item, i) => (
          <li key={item.id}>
            <button type="button" onClick={() => go(i)} aria-label={`Show image ${i + 1} of ${items.length}`} aria-current={i === index} className={cn("relative block aspect-[4/5] w-full overflow-hidden border transition-colors", i === index ? "border-midnight" : "border-transparent hover:border-line-strong")}>
              <MediaImage media={item.media} sizes="80px" fill alt="" />
            </button>
          </li>
        ))}
      </ul>

      <div className="relative">
        {/* Mobile swipe / desktop viewer share the same scroller */}
        <div
          ref={scroller}
          className="scrollbar-none -mx-[var(--spacing-gutter)] flex snap-x snap-mandatory overflow-x-auto lg:mx-0 lg:overflow-hidden"
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / el.clientWidth);
            if (i !== index) setIndex(i);
          }}
          aria-roledescription="carousel"
          aria-label={`${name} images`}
        >
          {items.map((item, i) => (
            <div key={item.id} className="relative aspect-[4/5] w-full shrink-0 snap-center bg-ice" aria-roledescription="slide" aria-label={`${i + 1} of ${items.length}`}>
              <button type="button" onClick={() => { setIndex(i); setZoomOpen(true); }} className="absolute inset-0 cursor-zoom-in" aria-label={`Enlarge image ${i + 1}`}>
                <MediaImage media={item.media} sizes="(min-width: 1024px) 50vw, 100vw" fill priority={i === 0} alt={item.media.alt || name} />
              </button>
            </div>
          ))}
        </div>

        {items.length > 1 && (
          <>
            <div className="mt-3 flex justify-center gap-1.5 lg:hidden" aria-hidden>
              {items.map((item, i) => <span key={item.id} className={cn("h-1 rounded-full transition-all", i === index ? "w-6 bg-midnight" : "w-1.5 bg-line-strong")} />)}
            </div>
            <button type="button" onClick={() => go(index - 1)} aria-label="Previous image" className="absolute top-1/2 left-3 hidden h-11 w-11 -translate-y-1/2 items-center justify-center bg-ivory/85 lg:inline-flex">
              <ChevronLeft className="h-5 w-5" strokeWidth={1.4} />
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Next image" className="absolute top-1/2 right-3 hidden h-11 w-11 -translate-y-1/2 items-center justify-center bg-ivory/85 lg:inline-flex">
              <ChevronRight className="h-5 w-5" strokeWidth={1.4} />
            </button>
          </>
        )}
        <span className="pointer-events-none absolute right-3 bottom-3 hidden items-center gap-1 bg-ivory/85 px-2 py-1 text-[0.65rem] tracking-[0.14em] uppercase lg:inline-flex">
          <ZoomIn className="h-3 w-3" /> Click to zoom
        </span>
      </div>

      <Dialog.Root open={zoomOpen} onOpenChange={setZoomOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ivory" />
          <Dialog.Content className="fixed inset-0 z-50 flex flex-col focus:outline-none">
            <Dialog.Title className="sr-only">{name} — image {index + 1} of {items.length}</Dialog.Title>
            <Dialog.Description className="sr-only">Use the arrow buttons to move between images.</Dialog.Description>
            <div className="flex h-14 items-center justify-between px-4">
              <span className="text-xs tracking-[0.14em] text-muted uppercase">{index + 1} / {items.length}</span>
              <Dialog.Close className="inline-flex h-11 w-11 items-center justify-center" aria-label="Close"><X className="h-5 w-5" /></Dialog.Close>
            </div>
            <div className="relative flex-1 overflow-auto">
              <MediaImage media={items[index]?.media} sizes="100vw" className="mx-auto h-auto w-full max-w-5xl" alt={items[index]?.media.alt || name} />
            </div>
            {items.length > 1 && (
              <div className="flex justify-center gap-3 p-4">
                <button type="button" onClick={() => go(index - 1)} className="inline-flex h-11 w-11 items-center justify-center border border-line" aria-label="Previous image"><ChevronLeft className="h-5 w-5" /></button>
                <button type="button" onClick={() => go(index + 1)} className="inline-flex h-11 w-11 items-center justify-center border border-line" aria-label="Next image"><ChevronRight className="h-5 w-5" /></button>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
