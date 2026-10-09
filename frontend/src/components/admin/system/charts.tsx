"use client";

/**
 * Minimal, dependency-free charts for admin reports (plain SVG/HTML).
 * Follows the dataviz method: single-series → one hue, no legend box; thin marks with 4px rounded
 * data-ends anchored to the baseline; hairline recessive gridlines; selective direct labels;
 * per-mark tooltip on hover and keyboard focus; a table alternative is always available.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { formatCount } from "./format";

/** Categorical slot 1 (validated against the light surface with the dataviz palette validator). */
const SERIES = "#2a78d6";
const SERIES_ACTIVE = "#1c5cab";
const GRID = "#e2e8f0";

export type ColumnDatum = { key: string; tick: string; label: string; value: number };

function niceMax(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 4, step: 1 };
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const safeStep = Math.max(1, step);
  return { top: Math.ceil(max / safeStep) * safeStep, step: safeStep };
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Column chart over time (single series). Arrow keys move between columns when focused. */
export function ColumnChart({ data, unit, height = 220, summary }: { data: ColumnDatum[]; unit: [singular: string, plural: string]; height?: number; summary: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const descId = useId();
  const margin = { top: 20, right: 8, bottom: 26, left: 36 };
  const plotW = Math.max(0, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;
  const max = Math.max(0, ...data.map((d) => d.value));
  const { top, step } = niceMax(max);
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(2, Math.min(24, band - 2));
  const y = (v: number) => margin.top + plotH - (v / top) * plotH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const tickEvery = Math.max(1, Math.ceil((data.length * 56) / Math.max(plotW, 1)));
  const maxIndex = max > 0 ? data.findIndex((d) => d.value === max) : -1;
  const fmt = (v: number) => `${formatCount(v)} ${v === 1 ? unit[0] : unit[1]}`;

  const onKey = (e: KeyboardEvent) => {
    if (!data.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActive((i) => {
        if (e.key === "Home") return 0;
        if (e.key === "End") return data.length - 1;
        const cur = i ?? (e.key === "ArrowRight" ? -1 : data.length);
        return Math.min(data.length - 1, Math.max(0, cur + (e.key === "ArrowRight" ? 1 : -1)));
      });
    } else if (e.key === "Escape") setActive(null);
  };

  const activeDatum = active !== null ? data[active] : null;
  const tipX = active !== null ? margin.left + band * active + band / 2 : 0;

  return (
    <div ref={ref} className="relative w-full">
      <div
        tabIndex={0}
        role="img"
        aria-roledescription="column chart"
        aria-label={summary}
        aria-describedby={descId}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal"
      >
        <span id={descId} className="sr-only">Use the left and right arrow keys to read each value. A data table follows the chart.</span>
        {width > 0 && (
          <svg width={width} height={height} aria-hidden="true" onPointerLeave={() => setActive(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={margin.left} x2={width - margin.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} shapeRendering="crispEdges" />
                <text x={margin.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[10px] tabular-nums">{formatCount(t)}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = margin.left + band * i + band / 2;
              const h = Math.max(0, y(0) - y(d.value));
              const x0 = cx - barW / 2;
              const r = Math.min(4, barW / 2, h);
              const path = h > 0 ? `M${x0},${y(0)} V${y(0) - h + r} Q${x0},${y(0) - h} ${x0 + r},${y(0) - h} H${x0 + barW - r} Q${x0 + barW},${y(0) - h} ${x0 + barW},${y(0) - h + r} V${y(0)} Z` : "";
              return (
                <g key={d.key}>
                  {path && <path d={path} fill={active === i ? SERIES_ACTIVE : SERIES} />}
                  {i === maxIndex && (
                    <text x={cx} y={y(d.value) - 6} textAnchor="middle" className="fill-slate-700 text-[10px] font-medium tabular-nums">{formatCount(d.value)}</text>
                  )}
                  {i % tickEvery === 0 && (
                    <text x={cx} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[10px]">{d.tick}</text>
                  )}
                  {/* Hit target spans the whole band, not just the painted bar. */}
                  <rect x={margin.left + band * i} y={margin.top} width={band} height={plotH} fill="transparent" onPointerEnter={() => setActive(i)} onPointerMove={() => active !== i && setActive(i)} />
                </g>
              );
            })}
            <line x1={margin.left} x2={width - margin.right} y1={y(0)} y2={y(0)} stroke="#94a3b8" strokeWidth={1} shapeRendering="crispEdges" />
          </svg>
        )}
      </div>
      {activeDatum && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
          style={{ left: Math.min(Math.max(tipX, 70), Math.max(width - 70, 70)), top: Math.max(0, y(activeDatum.value) - 54) }}
        >
          <span className="block text-sm font-semibold text-slate-900 tabular-nums">{fmt(activeDatum.value)}</span>
          <span className="text-slate-500">{activeDatum.label}</span>
        </div>
      )}
    </div>
  );
}

/** Horizontal bar list: label, bar and value at the tip. Sorted descending by the caller. */
export function BarList({ items, unit, emptyLabel = "No data in this period." }: { items: { key: string; label: string; value: number }[]; unit: [string, string]; emptyLabel?: string }) {
  const max = Math.max(0, ...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!items.length || max === 0) return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const pct = total ? Math.round((item.value / total) * 100) : 0;
        return (
          <li key={item.key} className="text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-slate-700" title={item.label}>{item.label}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="h-3 rounded-r-[4px]" style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 1.5 : 0)}%`, backgroundColor: SERIES }} aria-hidden />
              </div>
              <span className="w-20 shrink-0 text-right text-xs text-slate-700 tabular-nums">
                {formatCount(item.value)} <span className="text-slate-400">· {pct}%</span>
                <span className="sr-only"> {item.value === 1 ? unit[0] : unit[1]}</span>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Data table alternative; visually hidden by default with a toggle to show it. */
export function ChartTable({ caption, columns, rows }: { caption: string; columns: [string, string]; rows: { key: string; label: string; value: string }[] }) {
  const [show, setShow] = useState(false);
  return (
    <div className="mt-3">
      <button type="button" onClick={() => setShow((s) => !s)} className="text-xs font-medium text-royal hover:underline" aria-expanded={show}>
        {show ? "Hide data table" : "Show data table"}
      </button>
      <div className={cn(show ? "mt-2 max-h-72 overflow-y-auto rounded-md border border-slate-200" : "sr-only")}>
        <table className="w-full text-left text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-slate-50 text-slate-500">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">{columns[0]}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{columns[1]}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="px-3 py-1.5 font-normal text-slate-700">{r.label}</th>
                <td className="px-3 py-1.5 text-right tabular-nums">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
