import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingPage } from "@/components/store/listing/listing-page";
import { api } from "@/lib/api-server";
import type { SearchParamsInput } from "@/lib/listing";
import { listingMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParamsInput> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const occasion = await api.occasion(slug);
  if (!occasion) return { title: "Not found" };
  return listingMetadata({ title: occasion.seo.title, description: occasion.seo.description, path: `/occasions/${slug}`, searchParams: await searchParams });
}

export default async function OccasionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const [occasion, query] = await Promise.all([api.occasion(slug), searchParams]);
  if (!occasion) notFound();

  return (
    <ListingPage
      header={{
        title: `${occasion.name}`,
        eyebrow: "Shop by Occasion",
        intro: occasion.description,
        banner: occasion.banner,
        breadcrumbs: [{ name: "Occasions", href: "/occasions" }, { name: occasion.name }],
      }}
      context={{ occasion: slug }}
      searchParams={query}
      basePath={`/occasions/${slug}`}
      listName={`occasion:${slug}`}
      hideFacets={["occasions"]}
    />
  );
}
