import { ButtonLink } from "@/components/store/ui";

export default function StoreNotFound() {
  return (
    <section className="container-editorial flex min-h-[60svh] flex-col items-center justify-center py-24 text-center">
      <p className="eyebrow mb-4 text-royal">Page not found</p>
      <h1 className="display text-display text-midnight">We couldn’t find that page</h1>
      <p className="mt-6 max-w-md text-muted">The link may be outdated, or the design may have moved. Explore the collection or search for what you had in mind.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/shop">Explore the Collection</ButtonLink>
        <ButtonLink href="/search" variant="outline">Search</ButtonLink>
      </div>
    </section>
  );
}
