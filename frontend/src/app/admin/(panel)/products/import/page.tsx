"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, FileUp, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { RequirePermission } from "@/components/admin/guard";
import { Badge, Button, Card, DataTable, EmptyState, PageHeader, StatusBadge, type Column } from "@/components/admin/ui";
import { adminApi, useAdminQuery } from "@/lib/admin/hooks";
import { ApiRequestError, downloadFile, uploadWithProgress } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";

type ImportRun = {
  id: number;
  original_name: string;
  dry_run: boolean;
  status: "queued" | "processing" | "completed" | "failed";
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  row_errors: { line: number | null; sku: string | null; field: string; message: string }[];
  preview: { line: number; sku: string; name: string; action: "create" | "update"; variants: number }[];
  user: string | null;
  created_at: string;
  finished_at: string | null;
};

export default function ImportPage() {
  return (
    <RequirePermission permission="products.import">
      <PageHeader
        title="Import & export products"
        breadcrumbs={[{ label: "Products", href: "/admin/products" }, { label: "Import" }]}
        description="Upload a CSV (one row per variant). Every import starts as a dry run so you can review changes and per-row errors before anything is written. Re-importing the same file updates the same products — rows are matched on SKU."
      />
      <ImportFlow />
    </RequirePermission>
  );
}

function ImportFlow() {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const run = useAdminQuery<{ data: ImportRun }>(current ? `/admin/products/imports/${current}` : null, {}, {
    refetchInterval: (d) => (d && ["completed", "failed"].includes(d.data.status) ? false : 1500),
  });
  const history = useAdminQuery<{ data: ImportRun[] }>("/admin/products/imports");
  const result = run.data?.data;
  const finished = result && ["completed", "failed"].includes(result.status);

  const upload = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("dry_run", "1");
    setProgress(0);
    try {
      const { data } = await uploadWithProgress<{ data: ImportRun }>("/admin/products/import", form, setProgress);
      setCurrent(data.id);
      await queryClient.invalidateQueries({ queryKey: ["admin", "/admin/products/imports"] });
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? (e.field("file") ?? e.message) : "Upload failed");
    } finally {
      setProgress(null);
    }
  };

  const commit = async () => {
    if (!result) return;
    const { data } = await adminApi.post<{ data: ImportRun }>(`/admin/products/imports/${result.id}/commit`);
    setCurrent(data.id);
    await queryClient.invalidateQueries({ queryKey: ["admin", "/admin/products"] });
    toast.success("Import started");
  };

  const errorColumns: Column<ImportRun["row_errors"][number]>[] = [
    { key: "line", header: "Line", cell: (e) => e.line ?? "—" },
    { key: "sku", header: "SKU", cell: (e) => <span className="font-mono text-xs">{e.sku ?? "—"}</span> },
    { key: "field", header: "Field", cell: (e) => e.field },
    { key: "message", header: "Problem", cell: (e) => <span className="text-red-800">{e.message}</span> },
  ];
  const previewColumns: Column<ImportRun["preview"][number]>[] = [
    { key: "line", header: "Line", cell: (p) => p.line },
    { key: "sku", header: "SKU", cell: (p) => <span className="font-mono text-xs">{p.sku}</span> },
    { key: "name", header: "Name", cell: (p) => p.name },
    { key: "action", header: "Action", cell: (p) => <Badge tone={p.action === "create" ? "green" : "blue"}>{p.action === "create" ? "Create" : "Update"}</Badge> },
    { key: "variants", header: "Variants", cell: (p) => p.variants },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <Card title="1. Upload CSV">
          <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-slate-300 p-8 text-center">
            <FileUp className="h-6 w-6 text-slate-400" />
            <p className="text-sm text-slate-600">CSV up to 10 MB / 5,000 rows. Images are managed in the product editor, not via CSV.</p>
            <Button onClick={() => input.current?.click()} loading={progress !== null}>{progress !== null ? `Uploading ${progress}%` : "Choose CSV file"}</Button>
            <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          </div>
        </Card>

        {result && (
          <Card title={result.dry_run ? "2. Review dry run" : "Import result"} description={result.original_name} actions={<StatusBadge status={result.status} />}>
            {!finished ? (
              <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Processing… this runs in the background.</p>
            ) : (
              <div className="space-y-5">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[["Rows", result.total_rows], [result.dry_run ? "Would create" : "Created", result.created_count], [result.dry_run ? "Would update" : "Updated", result.updated_count], ["Skipped", result.skipped_count], ["Errors", result.error_count]].map(([label, value]) => (
                    <div key={label as string} className="rounded-md bg-slate-50 p-3">
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
                {result.row_errors.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium">Row errors</h3>
                    <div className="overflow-hidden rounded-md border border-red-100"><DataTable columns={errorColumns} rows={result.row_errors} rowKey={(e) => `${e.line}-${e.field}-${e.message}`} /></div>
                  </div>
                )}
                {result.preview.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium">{result.dry_run ? "Planned changes" : "Applied changes"} (first 50)</h3>
                    <div className="overflow-hidden rounded-md border border-slate-200"><DataTable columns={previewColumns} rows={result.preview} rowKey={(p) => p.sku} /></div>
                  </div>
                )}
                {result.dry_run && result.status === "completed" && (result.created_count + result.updated_count) > 0 && (
                  <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 p-4">
                    <p className="flex-1 text-sm text-slate-600">Rows with errors will be skipped. Products are created as drafts unless the CSV status says otherwise.</p>
                    <Button onClick={commit}>Import {result.created_count + result.updated_count} product(s)</Button>
                  </div>
                )}
                {!result.dry_run && result.status === "completed" && <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Import finished.</p>}
              </div>
            )}
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <Card title="Templates & export">
          <div className="grid gap-2">
            <Button variant="secondary" onClick={() => downloadFile("/admin/products/import/template").catch(() => toast.error("Download failed"))}><Download className="h-4 w-4" /> Download template</Button>
            <Button variant="secondary" onClick={() => downloadFile("/admin/products/export").catch(() => toast.error("Export failed"))}><Download className="h-4 w-4" /> Export all products</Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Lists use “|” as a separator (e.g. categories: women/sarees|bridal/bridal-sarees). New sizes and colours in the file are added to the option lists.</p>
        </Card>
        <Card title="Recent imports" padded={false}>
          {history.data?.data.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {history.data.data.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setCurrent(r.id)} className="w-full px-4 py-2.5 text-left hover:bg-slate-50">
                    <span className="flex items-center justify-between gap-2"><span className="truncate">{r.original_name}</span><StatusBadge status={r.status} /></span>
                    <span className="text-xs text-slate-500">{r.dry_run ? "Dry run" : "Import"} · {formatDateTime(r.created_at)} · {r.created_count + r.updated_count} ok, {r.error_count} errors</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No imports yet" />}
        </Card>
      </div>
    </div>
  );
}
