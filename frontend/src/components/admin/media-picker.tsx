"use client";

/* eslint-disable @next/next/no-img-element -- admin thumbnails come straight from backend renditions */
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Film, ImagePlus, Loader2, Search, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { ApiRequestError, uploadWithProgress } from "@/lib/api-client";
import { useAdminQuery, useDebounced, type ListResponse } from "@/lib/admin/hooks";
import { cn } from "@/lib/utils";
import { Button, Modal } from "./ui";

export type AdminMedia = {
  id: number;
  kind: "image" | "video" | "document";
  original_name: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  title: string | null;
  folder: string | null;
  url: string;
  thumb_url: string | null;
  preview_url: string | null;
  processing_status: string;
  processing_error: string | null;
  created_at: string;
};

type Upload = { id: string; name: string; progress: number; error?: string };

/** Drag-and-drop uploader with per-file progress. Validation happens server-side (type sniffing, size, dimensions). */
export function MediaUploader({ onUploaded, accept = "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,application/pdf", folder, multiple = true, compact }: { onUploaded?: (media: AdminMedia[]) => void; accept?: string; folder?: string; multiple?: boolean; compact?: boolean }) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).slice(0, multiple ? 20 : 1);
      const done: AdminMedia[] = [];
      await Promise.all(
        list.map(async (file) => {
          const id = `${file.name}-${file.size}-${Math.random()}`;
          setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);
          const form = new FormData();
          form.append("file", file);
          if (folder) form.append("folder", folder);
          try {
            const result = await uploadWithProgress<{ data: AdminMedia }>("/admin/media", form, (p) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: p } : x))));
            done.push(result.data);
            setUploads((u) => u.filter((x) => x.id !== id));
          } catch (error) {
            const message = error instanceof ApiRequestError ? (error.field("file") ?? error.message) : "Upload failed";
            setUploads((u) => u.map((x) => (x.id === id ? { ...x, error: message } : x)));
          }
        }),
      );
      if (done.length) {
        toast.success(`${done.length} file${done.length > 1 ? "s" : ""} uploaded`);
        await queryClient.invalidateQueries({ queryKey: ["admin", "/admin/media"] });
        onUploaded?.(done);
      }
    },
    [folder, multiple, onUploaded, queryClient],
  );

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFiles(e.dataTransfer.files); }}
        className={cn("flex flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition-colors", compact ? "px-4 py-5" : "px-6 py-10", dragging ? "border-royal bg-sky-50" : "border-slate-300 bg-slate-50/60")}
      >
        <Upload className="h-5 w-5 text-slate-400" aria-hidden />
        <p className="mt-2 text-sm text-slate-700">
          Drag files here or{" "}
          <button type="button" onClick={() => input.current?.click()} className="font-medium text-royal underline-offset-2 hover:underline">browse</button>
        </p>
        {!compact && <p className="mt-1 text-xs text-slate-500">JPEG, PNG, WebP or AVIF up to 25 MB (shortest edge ≥ 300px) · MP4/WebM video · PDF guides</p>}
        <input ref={input} type="file" accept={accept} multiple={multiple} className="sr-only" onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {uploads.length > 0 && (
        <ul className="mt-3 space-y-2" aria-live="polite">
          {uploads.map((u) => (
            <li key={u.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{u.name}</span>
                {u.error ? (
                  <button type="button" onClick={() => setUploads((x) => x.filter((y) => y.id !== u.id))} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
                ) : (
                  <span className="tabular-nums text-slate-500">{u.progress}%</span>
                )}
              </div>
              {u.error ? <p className="mt-1 text-red-700">{u.error}</p> : (
                <div className="mt-1.5 h-1 overflow-hidden rounded bg-slate-100"><div className="h-full bg-royal transition-all" style={{ width: `${u.progress}%` }} /></div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MediaThumb({ media, className }: { media: Pick<AdminMedia, "kind" | "thumb_url" | "url" | "alt_text" | "original_name"> | null | undefined; className?: string }) {
  if (!media) return <div className={cn("flex items-center justify-center bg-slate-100 text-slate-400", className)}><ImagePlus className="h-5 w-5" /></div>;
  if (media.kind === "image") return <img src={media.thumb_url ?? media.url} alt={media.alt_text ?? ""} className={cn("bg-slate-100 object-cover", className)} loading="lazy" />;
  return (
    <div className={cn("flex flex-col items-center justify-center gap-1 bg-slate-100 p-2 text-center text-[10px] text-slate-500", className)}>
      {media.kind === "video" ? <Film className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
      <span className="line-clamp-2 break-all">{media.original_name}</span>
    </div>
  );
}

/** Media library browser in a modal; returns selected assets. */
export function MediaPickerDialog({ open, onOpenChange, onSelect, multiple = false, kind = "image" }: { open: boolean; onOpenChange: (o: boolean) => void; onSelect: (media: AdminMedia[]) => void; multiple?: boolean; kind?: AdminMedia["kind"] | "any" }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminMedia[]>([]);
  const debounced = useDebounced(q);
  const { data, isLoading } = useAdminQuery<ListResponse<AdminMedia>>(open ? "/admin/media" : null, { q: debounced, kind: kind === "any" ? undefined : kind, page, per_page: 40 }, { keepPrevious: true });

  const toggle = (m: AdminMedia) => {
    if (!multiple) {
      onSelect([m]);
      onOpenChange(false);
      return;
    }
    setSelected((s) => (s.some((x) => x.id === m.id) ? s.filter((x) => x.id !== m.id) : [...s, m]));
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { onOpenChange(o); if (!o) setSelected([]); }}
      title="Media library"
      description="Choose existing media or upload new files."
      size="xl"
      footer={multiple ? (
        <>
          <span className="mr-auto self-center text-sm text-slate-500">{selected.length} selected</span>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!selected.length} onClick={() => { onSelect(selected); onOpenChange(false); setSelected([]); }}>Add selected</Button>
        </>
      ) : undefined}
    >
      <div className="space-y-4">
        <MediaUploader compact onUploaded={(m) => (multiple ? setSelected((s) => [...s, ...m]) : (onSelect(m.slice(0, 1)), onOpenChange(false)))} accept={kind === "image" ? "image/jpeg,image/png,image/webp,image/avif" : kind === "document" ? "application/pdf" : kind === "video" ? "video/mp4,video/webm" : undefined} multiple={multiple} />
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by file name or alt text" className="h-10 w-full rounded-md border border-slate-300 pr-3 pl-9 text-sm" aria-label="Search media" />
        </div>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
            {data?.data.map((m) => {
              const isSelected = selected.some((s) => s.id === m.id);
              return (
                <li key={m.id}>
                  <button type="button" onClick={() => toggle(m)} className={cn("group block w-full overflow-hidden rounded-md border-2 text-left", isSelected ? "border-royal" : "border-transparent hover:border-slate-300")} aria-pressed={isSelected}>
                    <MediaThumb media={m} className="aspect-square w-full" />
                    <span className="block truncate px-1 py-1 text-[11px] text-slate-600">{m.original_name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {data && data.meta.last_page > 1 && (
          <div className="flex justify-center gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="self-center text-xs text-slate-500">{page} / {data.meta.last_page}</span>
            <Button size="sm" variant="secondary" disabled={page >= data.meta.last_page} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Single media field (e.g. a banner or cover image) storing a media asset id. */
export function MediaField({ value, onChange, preview, kind = "image", label = "Choose image" }: { value: number | null | undefined; onChange: (id: number | null, media?: AdminMedia) => void; preview?: string | null; kind?: AdminMedia["kind"]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<{ id: number; url: string | null; name: string } | null>(value ? { id: value, url: preview ?? null, name: `#${value}` } : null);
  const shown = value ? current ?? { id: value, url: preview ?? null, name: `#${value}` } : null;

  return (
    <div className="flex items-center gap-3">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        {shown?.url ? <img src={shown.url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-400">{kind === "document" ? <FileText className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}</div>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{value ? "Replace" : label}</Button>
        {value ? <Button variant="ghost" size="sm" onClick={() => { onChange(null); setCurrent(null); }}>Remove</Button> : null}
        {shown && !shown.url && <span className="self-center text-xs text-slate-500">{shown.name}</span>}
      </div>
      <MediaPickerDialog open={open} onOpenChange={setOpen} kind={kind} onSelect={([m]) => { setCurrent({ id: m.id, url: m.thumb_url ?? (m.kind === "image" ? m.url : null), name: m.original_name }); onChange(m.id, m); }} />
    </div>
  );
}
