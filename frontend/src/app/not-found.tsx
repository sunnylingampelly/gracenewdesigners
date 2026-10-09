import Link from "next/link";

/** Fallback for URLs outside every route group (rendered without the storefront chrome). */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-ivory px-6 text-center">
      <p className="eyebrow mb-4 text-royal">Page not found</p>
      <h1 className="display text-display text-midnight">We couldn’t find that page</h1>
      <Link href="/" className="mt-10 inline-flex min-h-12 items-center bg-midnight px-7 text-[0.7rem] font-semibold tracking-[0.2em] text-ivory uppercase">
        Return home
      </Link>
    </main>
  );
}
