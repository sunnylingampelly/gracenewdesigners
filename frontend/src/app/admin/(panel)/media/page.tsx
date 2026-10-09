"use client";

/* eslint-disable @next/next/no-img-element -- admin previews come straight from backend renditions */
import { AlertTriangle, Copy, ExternalLink, FileText, Film, RefreshCw, Search, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { RequirePermission } from "@/components/admin/guard";
import { MediaThumb, MediaUploader, type AdminMedia } from "@/components/admin/media-picker";
import { Badge, Button, Card, Checkbox, EmptyState, ErrorNotice, Field, Input, KeyValue, Modal, PageHeader, Pagination, Select, Spinner, StatusBadge, useConfirm } from "@/components/admin/ui";
import { formatBytes } from "@/components/admin/system/format";
import { useAuth } from "@/lib/admin/auth";
import { adminApi, useAdminMutation, useAdminQuery, useDebounced, useUrlState, type ListResponse } from "@/lib/admin/hooks";
import { ApiRequestError } from "@/lib/api-client";
import { cn, formatDateTime } from "@/lib/utils";

type MediaDetail = AdminMedia & { usages: Record<string, number> | [] };

export default function MediaPage() {
  return (
    <RequirePermission permission="media.view">
      <PageHeader title="Media library" description="Upload and organise images, videos and PDF guides. Every image needs alt text so the storefront stays accessible." />
      <Suspense fallback={<Spinner />}>
        <MediaLibrary />
      </Suspense>
    </RequirePermission>
  );
}

function MediaLibrary() {
  const { can } = useAuth();
  const canManage = can("media.manage");
  const [filters, setFilters] = useUrlState({ q: "", kind: "", folder: "", orphaned: "", page: "1" });
  const [q, setQ] = useState(filters.q);
  const [folder, setFolder] = useState(filters.folder);
  const debouncedQ = useDebounced(q);
  const debouncedFolder = useDebounced(folder);
  const [openId, setOpenId] = useState<number | null>(null);

  // Push debounced text filters into the URL once they settle.
  const syncNeeded = debouncedQ !== filters.q || debouncedFolder !== filters.folder;
  useEffect(() => {
    if (syncNeeded) setFilters({ q: debouncedQ, folder: debouncedFolder });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setFilters is recreated each render
  }, [syncNeeded, debouncedQ, debouncedFolder]);

  const page = Number(filters.page) || 1;
  const { data, isLoading, isFetching, error, refetch } = useAdminQuery<ListResponse<AdminMedia>>(
    "/admin/media",
    { q: filters.q, kind: filters.kind, folder: filters.folder, orphaned: filters.orphaned ? 1 : undefined, page, per_page: 40 },
    { keepPrevious: true },
  );

  return (
    <div className="space-y-6">
      {canManage && (
        <Card title="Upload" description="Files are checked server-side; images are converted into responsive WebP renditions in the background.">
          <MediaUploader folder={filters.folder && /^[a-z0-9-]+$/.test(filters.folder) ? filters.folder : undefined} />
        </Card>
      )}

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-end">
          <Field label="Search" htmlFor="media-q" className="flex-1">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input id="media-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="File name, title or alt text" className="pl-9" />
            </div>
          </Field>
          <Field label="Type" htmlFor="media-kind" className="lg:w-40">
            <Select id="media-kind" value={filters.kind} onChange={(e) => setFilters({ kind: e.target.value })}>
              <option value="">All types</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="document">Documents</option>
            </Select>
          </Field>
          <Field label="Folder" htmlFor="media-folder" className="lg:w-48">
            <Input id="media-folder" value={folder} onChange={(e) => setFolder(e.target.value.toLowerCase())} placeholder="e.g. bridal-2026" />
          </Field>
          <div className="pb-2.5">
            <Checkbox label="Unused only" description="Not attached to products, taxonomy or pages" checked={filters.orphaned === "1"} onChange={(e) => setFilters({ orphaned: e.target.checked ? "1" : "" })} />
          </div>
        </div>

        {error ? (
          <div className="p-4"><ErrorNotice error={error} onRetry={() => refetch()} /></div>
        ) : isLoading ? (
          <Spinner label="Loading media" />
        ) : !data?.data.length ? (
          <EmptyState title="No media found" description={filters.q || filters.kind || filters.folder || filters.orphaned ? "Try clearing the filters." : "Upload your first images above."} />
        ) : (
          <ul className={cn("grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6", isFetching && "opacity-60")} aria-label="Media assets">
            {data.data.map((m) => {
              const missingAlt = m.kind === "image" && !m.alt_text?.trim();
              return (
                <li key={m.id}>
                  <button type="button" onClick={() => setOpenId(m.id)} className={cn("group block w-full overflow-hidden rounded-md border bg-white text-left shadow-sm transition-colors hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-royal", missingAlt ? "border-amber-300" : "border-slate-200")} aria-label={`Open ${m.original_name}`}>
                    <div className="relative">
                      <MediaThumb media={m} className="aspect-square w-full" />
                      <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1">
                        {m.processing_status !== "processed" && <StatusBadge status={m.processing_status} />}
                        {missingAlt && <Badge tone="amber">No alt text</Badge>}
                      </div>
                    </div>
                    <div className="px-2 py-1.5">
                      <p className="truncate text-xs font-medium text-slate-800">{m.title || m.original_name}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {m.width && m.height ? `${m.width}×${m.height} · ` : ""}{formatBytes(m.size_bytes)}{m.folder ? ` · ${m.folder}` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onPage={(p) => setFilters({ page: String(p) })} />}
      </Card>

      {openId !== null && <MediaDetailsModal id={openId} canManage={canManage} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function MediaDetailsModal({ id, canManage, onClose }: { id: number; canManage: boolean; onClose: () => void }) {
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: MediaDetail }>(`/admin/media/${id}`);
  const media = data?.data;
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={media ? media.title || media.original_name : "Media details"} size="xl">
      {isLoading ? <Spinner /> : error || !media ? <ErrorNotice error={error} onRetry={() => refetch()} /> : <MediaDetails key={`${media.id}-${media.processing_status}`} media={media} canManage={canManage} onDeleted={onClose} />}
    </Modal>
  );
}

function MediaDetails({ media, canManage, onDeleted }: { media: MediaDetail; canManage: boolean; onDeleted: () => void }) {
  const [form, setForm] = useState({ alt_text: media.alt_text ?? "", title: media.title ?? "", folder: media.folder ?? "" });
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const queryClient = useQueryClient();
  const usages = Array.isArray(media.usages) ? {} : media.usages;
  const usageEntries = Object.entries(usages);
  const missingAlt = media.kind === "image" && !form.alt_text.trim();
  const dirty = form.alt_text !== (media.alt_text ?? "") || form.title !== (media.title ?? "") || form.folder !== (media.folder ?? "");

  const save = useAdminMutation(
    () => adminApi.patch(`/admin/media/${media.id}`, { alt_text: form.alt_text.trim() || null, title: form.title.trim() || null, folder: form.folder.trim() || null }),
    { success: "Media details saved", invalidate: [["admin", "/admin/media"], ["admin", `/admin/media/${media.id}`]] },
  );
  const reprocess = useAdminMutation(() => adminApi.post(`/admin/media/${media.id}/reprocess`), { success: "Reprocessing queued", invalidate: [["admin", "/admin/media"], ["admin", `/admin/media/${media.id}`]] });

  const copyUrl = async () => {
    const absolute = new URL(media.url, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(absolute);
      toast.success("URL copied");
    } catch {
      toast.error("Could not copy — select and copy the URL manually.");
    }
  };

  const remove = () =>
    confirm({
      title: "Delete this file?",
      description: "The file and all its renditions are removed permanently. Files still in use cannot be deleted.",
      confirmLabel: "Delete",
      destructive: true,
      action: async () => {
        setDeleteError(null);
        try {
          await adminApi.delete(`/admin/media/${media.id}`);
          toast.success("File deleted");
          queryClient.removeQueries({ queryKey: ["admin", `/admin/media/${media.id}`] });
          await queryClient.invalidateQueries({ queryKey: ["admin", "/admin/media"] });
          onDeleted();
        } catch (e) {
          const message = e instanceof ApiRequestError ? (e.field("media") ?? e.message) : "The file could not be deleted.";
          setDeleteError(message);
          toast.error(message);
        }
      },
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
          {media.kind === "image" ? (
            <img src={media.preview_url ?? media.url} alt={media.alt_text ?? ""} className="max-h-[50vh] w-auto object-contain" />
          ) : media.kind === "video" ? (
            <video src={media.url} controls className="max-h-[50vh] w-full" aria-label={media.title ?? media.original_name} />
          ) : (
            <div className="flex flex-col items-center gap-2 p-8 text-sm text-slate-500"><FileText className="h-8 w-8" aria-hidden />{media.original_name}</div>
          )}
        </div>
        <KeyValue
          items={[
            ["File", <span key="f" className="break-all">{media.original_name}</span>],
            ["Type", <span key="t" className="flex items-center gap-1">{media.kind === "video" ? <Film className="h-3.5 w-3.5" aria-hidden /> : null}{media.mime_type}</span>],
            ["Dimensions", media.width && media.height ? `${media.width} × ${media.height} px` : "—"],
            ["Size", formatBytes(media.size_bytes)],
            ["Uploaded", formatDateTime(media.created_at)],
            ["Processing", <StatusBadge key="s" status={media.processing_status} />],
          ]}
        />
        {media.processing_error && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{media.processing_error}</div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={copyUrl}><Copy className="h-3.5 w-3.5" aria-hidden /> Copy URL</Button>
          <a href={media.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-slate-700 hover:bg-slate-100"><ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open original</a>
          {canManage && media.kind === "image" && media.processing_status !== "processed" && (
            <Button variant="secondary" size="sm" loading={reprocess.isPending} onClick={() => reprocess.mutate(undefined)}><RefreshCw className="h-3.5 w-3.5" aria-hidden /> Reprocess</Button>
          )}
          {canManage && media.kind === "image" && media.processing_status === "processed" && (
            <Button variant="ghost" size="sm" loading={reprocess.isPending} onClick={() => reprocess.mutate(undefined)}><RefreshCw className="h-3.5 w-3.5" aria-hidden /> Regenerate renditions</Button>
          )}
        </div>
      </div>

      <div className="space-y-5">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(undefined);
          }}
        >
          <Field
            label="Alt text"
            htmlFor="media-alt"
            required={media.kind === "image"}
            error={save.fieldError("alt_text")}
            hint="Describe what the image shows for people using screen readers — e.g. “Ivory silk lehenga with gold zari border, front view”."
          >
            <Input id="media-alt" value={form.alt_text} onChange={(e) => setForm({ ...form, alt_text: e.target.value })} maxLength={300} disabled={!canManage} invalid={missingAlt} aria-describedby={missingAlt ? "media-alt-warning" : undefined} />
          </Field>
          {missingAlt && (
            <p id="media-alt-warning" className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> This image has no alt text. Add a short description so it is accessible and indexable.
            </p>
          )}
          <Field label="Title" htmlFor="media-title" error={save.fieldError("title")}>
            <Input id="media-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={255} disabled={!canManage} />
          </Field>
          <Field label="Folder" htmlFor="media-folder-edit" error={save.fieldError("folder")} hint="Lowercase letters, numbers and dashes.">
            <Input id="media-folder-edit" value={form.folder} onChange={(e) => setForm({ ...form, folder: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} maxLength={100} disabled={!canManage} />
          </Field>
          {canManage && (
            <div className="flex justify-end">
              <Button type="submit" loading={save.isPending} disabled={!dirty}>Save details</Button>
            </div>
          )}
        </form>

        <section aria-labelledby="usage-heading" className="rounded-md border border-slate-200 p-4">
          <h3 id="usage-heading" className="text-sm font-semibold text-slate-900">Where it’s used</h3>
          {usageEntries.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {usageEntries.map(([area, count]) => (
                <li key={area} className="flex justify-between"><span className="text-slate-600 capitalize">{area}</span><span className="tabular-nums">{count}</span></li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Not used anywhere — safe to delete.</p>
          )}
        </section>

        {canManage && (
          <div className="space-y-2 border-t border-slate-100 pt-4">
            {deleteError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">{deleteError}</p>}
            <Button variant="danger" size="sm" onClick={remove}><Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete file</Button>
            {usageEntries.length > 0 && <p className="text-xs text-slate-500">Remove it from the places above before deleting.</p>}
          </div>
        )}
      </div>
      {dialog}
    </div>
  );
}
