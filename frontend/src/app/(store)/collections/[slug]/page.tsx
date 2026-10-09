import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingPage } from "@/components/store/listing/listing-page";
import { api } from "@/lib/api-server";
import type { SearchParamsInput } from "@/lib/listing";
import { listingMetadata } from "@/lib/seo";
import { mediaUrl } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParamsInput> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await api.collection(slug);
  if (!collection) return { title: "Not found" };
  return listingMetadata({ title: collection.seo.title, description: collection.seo.description, path: `/collections/${slug}`, searchParams: await searchParams, image: mediaUrl(collection.cover, "lg") });
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const [collection, query] = await Promise.all([api.collection(slug), searchParams]);
  if (!collection) notFound();

  return (
    <ListingPage
      header={{
        title: collection.name,
        eyebrow: collection.tagline ?? "Collection",
        intro: collection.story,
        banner: collection.banner,
        breadcrumbs: [{ name: "Collections", href: "/collections" }, { name: collection.name }],
      }}
      context={{ collection: slug }}
      searchParams={query}
      basePath={`/collections/${slug}`}
      listName={`collection:${slug}`}
      hideFacets={["collections"]}
    />
  );
}
