"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import type { ProductCard as Card } from "@/lib/types";
import { ProductCard } from "./product-card";

/** Horizontally scrolling product row with snap points; arrow buttons on desktop, swipe on touch. */
export function ProductRail({ products, listName }: { products: Card[]; listName: string }) {
  const scroller = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    track("view_item_list", { item_list_name: listName, results: products.length });
  }, [listName, products.length]);

  const scroll = (direction: 1 | -1) => scroller.current?.scrollBy({ left: direction * scroller.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className="relative">
      <ul ref={scroller} className="scrollbar-none -mx-[var(--spacing-gutter)] flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-[var(--spacing-gutter)] px-[var(--spacing-gutter)] sm:gap-6">
        {products.map((product, i) => (
          <li key={product.id} className="w-[68vw] shrink-0 snap-start xs:w-[56vw] sm:w-[40vw] md:w-[30vw] lg:w-[calc((100%-4.5rem)/4)]">
            <ProductCard product={product} listName={listName} index={i} sizes="(min-width: 1024px) 24vw, (min-width: 640px) 40vw, 68vw" />
          </li>
        ))}
      </ul>
      <div className="mt-8 hidden justify-end gap-2 lg:flex">
        <button type="button" onClick={() => scroll(-1)} disabled={edges.start} aria-label="Previous products" className="inline-flex h-11 w-11 items-center justify-center border border-ink/20 transition-colors hover:border-ink disabled:opacity-30">
          <ChevronLeft className="h-4 w-4" strokeWidth={1.4} />
        </button>
        <button type="button" onClick={() => scroll(1)} disabled={edges.end} aria-label="Next products" className="inline-flex h-11 w-11 items-center justify-center border border-ink/20 transition-colors hover:border-ink disabled:opacity-30">
          <ChevronRight className="h-4 w-4" strokeWidth={1.4} />
        </button>
      </div>
    </div>
  );
}
