export function PreviewBanner({ path }: { path: string }) {
  return (
    <div role="status" className="sticky top-0 z-50 flex items-center justify-center gap-4 bg-gold px-4 py-2 text-[0.7rem] font-semibold tracking-[0.16em] text-midnight uppercase">
      Preview — you are viewing unpublished content
      <a href={`/api/preview/exit?path=${encodeURIComponent(path)}`} className="underline underline-offset-4">Exit preview</a>
    </div>
  );
}
