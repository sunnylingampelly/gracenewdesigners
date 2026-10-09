"use client";

import { Eye, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { RequirePermission } from "@/components/admin/guard";
import { fromLocalInput, MediaIdField, openPreview, PAGE_TEMPLATES, sanitizePreviewHtml, snapshot, toLocalInput } from "@/components/admin/content/shared";
import { Button, Card, Checkbox, ErrorNotice, Field, Input, PageHeader, Select, Spinner, Textarea, useConfirm } from "@/components/admin/ui";
import { adminApi, useAdminMutation, useAdminQuery, useUnsavedChangesWarning } from "@/lib/admin/hooks";

type PageData = {
  id: number; title: string; slug: string; template: string; excerpt: string | null; body: string | null; hero_media_id: number | null; hero_url?: string | null;
  status: "draft" | "published"; published_at: string | null; show_in_footer: boolean; seo_title: string | null; seo_description: string | null; is_indexable: boolean;
};

export default function PageEditorPage() {
  return (
    <RequirePermission permission="content.manage">
      <PageLoader />
    </RequirePermission>
  );
}

function PageLoader() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: PageData }>(`/admin/pages/${id}`);
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorNotice error={error} onRetry={() => refetch()} />;
  return <PageEditor key={data.data.id} page={data.data} />;
}

function toForm(p: PageData) {
  return {
    title: p.title,
    slug: p.slug,
    template: p.template ?? "default",
    excerpt: p.excerpt ?? "",
    body: p.body ?? "",
    hero_media_id: p.hero_media_id,
    status: p.status,
    published_at: toLocalInput(p.published_at),
    show_in_footer: !!p.show_in_footer,
    seo_title: p.seo_title ?? "",
    seo_description: p.seo_description ?? "",
    is_indexable: p.is_indexable !== false,
  };
}
type Form = ReturnType<typeof toForm>;

type Tool = { label: string; title: string; open: string; close: string; block?: boolean };
const TOOLS: Tool[] = [
  { label: "H2", title: "Heading", open: "<h2>", close: "</h2>", block: true },
  { label: "H3", title: "Subheading", open: "<h3>", close: "</h3>", block: true },
  { label: "P", title: "Paragraph", open: "<p>", close: "</p>", block: true },
  { label: "B", title: "Bold", open: "<strong>", close: "</strong>" },
  { label: "I", title: "Italic", open: "<em>", close: "</em>" },
  { label: "• List", title: "Bulleted list", open: "<ul>\n  <li>", close: "</li>\n</ul>", block: true },
  { label: "1. List", title: "Numbered list", open: "<ol>\n  <li>", close: "</li>\n</ol>", block: true },
  { label: "Quote", title: "Blockquote", open: "<blockquote>", close: "</blockquote>", block: true },
];

function PageEditor({ page }: { page: PageData }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => toForm(page));
  const [saved, setSaved] = useState(() => snapshot(toForm(page)));
  const [current, setCurrent] = useState(page);
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const dirty = snapshot(form) !== saved;
  useUnsavedChangesWarning(dirty);
  const { confirm, dialog } = useConfirm();
  const ids = { title: useId(), slug: useId(), tpl: useId(), excerpt: useId(), body: useId(), status: useId(), pub: useId(), seoT: useId(), seoD: useId(), link: useId() };
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = useAdminMutation(
    () =>
      adminApi.patch<{ data: PageData }>(`/admin/pages/${page.id}`, {
        ...form,
        slug: form.slug || null,
        excerpt: form.excerpt || null,
        published_at: fromLocalInput(form.published_at),
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
      }),
    {
      success: "Page saved",
      invalidate: [["admin", "/admin/pages"]],
      onSuccess: (r) => {
        const next = toForm(r.data);
        setForm(next);
        setSaved(snapshot(next));
        setCurrent((c) => ({ ...r.data, hero_url: r.data.hero_media_id === c.hero_media_id ? c.hero_url : null }));
      },
    },
  );
  const fe = save.fieldError;

  const wrap = (open: string, close: string, block?: boolean) => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const selected = value.slice(s, e);
    const pre = block && s > 0 && value[s - 1] !== "\n" ? "\n" : "";
    const insert = `${pre}${open}${selected}${close}`;
    const next = value.slice(0, s) + insert + value.slice(e);
    set("body", next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = s + pre.length + open.length + selected.length;
      el.setSelectionRange(selected ? s : cursor, selected ? s + insert.length : cursor);
    });
  };

  const insertLink = () => {
    const url = (linkDraft ?? "").trim();
    if (!/^(\/|https:\/\/|mailto:|tel:)/.test(url)) {
      toast.error("Links must start with /, https://, mailto: or tel:");
      return;
    }
    wrap(`<a href="${url.replace(/"/g, "&quot;")}">`, "</a>");
    setLinkDraft(null);
  };

  const preview = async () => {
    if (dirty) toast.info("Preview shows the last saved version — save to include your latest edits.");
    try {
      await openPreview(async () => (await adminApi.get<{ data: { token: string } }>(`/admin/pages/${page.id}/preview-token`)).data.token, `/pages/${current.slug}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open preview");
    }
  };

  const remove = () =>
    confirm({
      title: `Delete “${current.title}”?`,
      description: "The page will be removed from the site and any menu links to it will stop showing.",
      confirmLabel: "Delete page",
      destructive: true,
      action: async () => {
        try {
          await adminApi.delete(`/admin/pages/${page.id}`);
          toast.success("Page deleted");
          setSaved(snapshot(form));
          router.push("/admin/pages");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not delete page");
        }
      },
    });

  return (
    <>
      <PageHeader
        title={form.title || "Untitled page"}
        breadcrumbs={[{ label: "Pages", href: "/admin/pages" }, { label: current.title }]}
        description={dirty ? "You have unsaved changes." : `/pages/${current.slug}`}
        actions={
          <>
            <Button variant="ghost" onClick={remove}><Trash2 className="h-4 w-4" /> Delete</Button>
            <Button variant="secondary" onClick={preview}><Eye className="h-4 w-4" /> Preview</Button>
            <Button loading={save.isPending} disabled={!dirty || !form.title.trim()} onClick={() => save.mutate(undefined)}>Save changes</Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Content">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Title" htmlFor={ids.title} required error={fe("title")} className="sm:col-span-2">
                  <Input id={ids.title} value={form.title} maxLength={200} onChange={(e) => set("title", e.target.value)} invalid={!!fe("title")} />
                </Field>
                <Field label="Slug" htmlFor={ids.slug} error={fe("slug")} hint="Changing the slug of a published page adds a redirect from the old URL.">
                  <Input id={ids.slug} value={form.slug} maxLength={200} onChange={(e) => set("slug", e.target.value)} invalid={!!fe("slug")} />
                </Field>
                <Field label="Template" htmlFor={ids.tpl} error={fe("template")}>
                  <Select id={ids.tpl} value={form.template} onChange={(e) => set("template", e.target.value)}>
                    {PAGE_TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Excerpt" htmlFor={ids.excerpt} error={fe("excerpt")} hint={`Short summary shown under the title. ${form.excerpt.length}/500`}>
                <Textarea id={ids.excerpt} rows={2} value={form.excerpt} maxLength={500} onChange={(e) => set("excerpt", e.target.value)} />
              </Field>
              <Field label="Hero image" error={fe("hero_media_id")}>
                <MediaIdField value={form.hero_media_id} preview={form.hero_media_id === current.hero_media_id ? current.hero_url : null} onChange={(v) => set("hero_media_id", v)} />
              </Field>
            </div>
          </Card>

          <Card title="Body" description="Allowed tags: h2, h3, h4, p, br, strong, em, u, blockquote, ul, ol, li, a, hr. Anything else is removed when you save.">
            <div className="mb-2 flex flex-wrap items-center gap-1" role="toolbar" aria-label="Formatting">
              {TOOLS.map((t) => (
                <Button key={t.label} size="sm" variant="secondary" title={t.title} aria-label={t.title} onClick={() => wrap(t.open, t.close, t.block)}>{t.label}</Button>
              ))}
              <Button size="sm" variant="secondary" title="Link" onClick={() => setLinkDraft(linkDraft === null ? "" : null)} aria-expanded={linkDraft !== null}>Link</Button>
            </div>
            {linkDraft !== null && (
              <form className="mb-2 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); insertLink(); }}>
                <Field label="Link URL" htmlFor={ids.link} className="min-w-60 flex-1">
                  <Input id={ids.link} value={linkDraft} onChange={(e) => setLinkDraft(e.target.value)} placeholder="/pages/contact or https://…" autoFocus />
                </Field>
                <Button size="sm" type="submit">Insert link</Button>
                <Button size="sm" variant="ghost" onClick={() => setLinkDraft(null)}>Cancel</Button>
              </form>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="HTML" htmlFor={ids.body} error={fe("body")}>
                <Textarea ref={bodyRef} id={ids.body} rows={22} value={form.body} onChange={(e) => set("body", e.target.value)} className="font-mono text-xs" spellCheck />
              </Field>
              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-slate-800">Preview</span>
                <div className="prose-couture max-h-[34rem] min-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white p-4" dangerouslySetInnerHTML={{ __html: sanitizePreviewHtml(form.body) || "<p><em>Nothing to preview yet.</em></p>" }} />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Publishing">
            <div className="space-y-4">
              <Field label="Status" htmlFor={ids.status} error={fe("status")}>
                <Select id={ids.status} value={form.status} onChange={(e) => set("status", e.target.value as Form["status"])}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </Select>
              </Field>
              <Field label="Publish date" htmlFor={ids.pub} error={fe("published_at")} hint="Set automatically when first published.">
                <Input id={ids.pub} type="datetime-local" value={form.published_at} onChange={(e) => set("published_at", e.target.value)} />
              </Field>
              <Checkbox checked={form.show_in_footer} onChange={(e) => set("show_in_footer", e.target.checked)} label="Show in footer" description="List this page in the storefront footer." />
            </div>
          </Card>
          <Card title="Search engine listing">
            <div className="space-y-4">
              <Field label="SEO title" htmlFor={ids.seoT} error={fe("seo_title")} hint={`${form.seo_title.length}/255 · Defaults to the page title.`}>
                <Input id={ids.seoT} value={form.seo_title} maxLength={255} onChange={(e) => set("seo_title", e.target.value)} />
              </Field>
              <Field label="SEO description" htmlFor={ids.seoD} error={fe("seo_description")} hint={`${form.seo_description.length}/500`}>
                <Textarea id={ids.seoD} rows={3} value={form.seo_description} maxLength={500} onChange={(e) => set("seo_description", e.target.value)} />
              </Field>
              <Checkbox checked={form.is_indexable} onChange={(e) => set("is_indexable", e.target.checked)} label="Allow search engines to index" description="Untick for pages that shouldn’t appear in search results." />
            </div>
          </Card>
        </div>
      </div>
      {dialog}
    </>
  );
}
