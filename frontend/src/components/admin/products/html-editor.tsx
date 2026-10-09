"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const TOOLS: { label: string; title: string; wrap: [string, string] }[] = [
  { label: "H2", title: "Heading", wrap: ["<h2>", "</h2>"] },
  { label: "H3", title: "Subheading", wrap: ["<h3>", "</h3>"] },
  { label: "P", title: "Paragraph", wrap: ["<p>", "</p>"] },
  { label: "B", title: "Bold", wrap: ["<strong>", "</strong>"] },
  { label: "I", title: "Italic", wrap: ["<em>", "</em>"] },
  { label: "• List", title: "Bulleted list", wrap: ["<ul>\n  <li>", "</li>\n</ul>"] },
  { label: "1. List", title: "Numbered list", wrap: ["<ol>\n  <li>", "</li>\n</ol>"] },
  { label: "Quote", title: "Quote", wrap: ["<blockquote>", "</blockquote>"] },
];

/**
 * Lightweight rich-text editing with a live preview. Output is sanitized server-side to an
 * editorial subset (h2–h4, p, lists, emphasis, quotes, links) — scripts and styles are stripped.
 */
export function HtmlEditor({ value, onChange, id, invalid }: { value: string; onChange: (v: string) => void; id?: string; invalid?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");

  const apply = ([open, close]: [string, string]) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e) || "text";
    onChange(value.slice(0, s) + open + selected + close + value.slice(e));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + open.length, s + open.length + selected.length);
    });
  };

  const link = () => {
    const url = window.prompt("Link URL (https://… or /path)");
    if (url && /^(https?:\/\/|\/|mailto:|tel:)/.test(url)) apply([`<a href="${url.replace(/"/g, "")}">`, "</a>"]);
  };

  return (
    <div className={cn("overflow-hidden rounded-md border bg-white shadow-sm", invalid ? "border-red-500" : "border-slate-300")}>
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        {TOOLS.map((t) => (
          <button key={t.label} type="button" title={t.title} onClick={() => apply(t.wrap)} disabled={tab === "preview"} className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-40">{t.label}</button>
        ))}
        <button type="button" title="Link" onClick={link} disabled={tab === "preview"} className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white disabled:opacity-40">Link</button>
        <div className="ml-auto flex rounded border border-slate-200 bg-white text-xs" role="tablist">
          {(["write", "preview"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("px-2.5 py-1 capitalize", tab === t && "bg-slate-900 text-white")}>{t}</button>
          ))}
        </div>
      </div>
      {tab === "write" ? (
        <textarea id={id} ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={10} className="block w-full resize-y px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none" />
      ) : (
        <div className="prose-couture max-w-none px-4 py-3 text-sm" dangerouslySetInnerHTML={{ __html: value || "<p><em>Nothing to preview.</em></p>" }} />
      )}
    </div>
  );
}
