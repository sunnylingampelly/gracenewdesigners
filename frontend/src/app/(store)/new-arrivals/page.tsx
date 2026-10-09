import type { Metadata } from "next";
import { ListingPage } from "@/components/store/listing/listing-page";
import type { SearchParamsInput } from "@/lib/listing";
import { listingMetadata } from "@/lib/seo";

type Props = { searchParams: Promise<SearchParamsInput> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return listingMetadata({ title: "New Arrivals", description: "The latest designs from the studio.", path: "/new-arrivals", searchParams: await searchParams });
}

export default async function NewArrivalsPage({ searchParams }: Props) {
  return (
    <ListingPage
      header={{ title: "New Arrivals", eyebrow: "Just In", intro: "The newest pieces from the studio, freshly added to the collection.", breadcrumbs: [{ name: "New Arrivals" }] }}
      context={{ new: "1", sort: "newest" }}
      searchParams={await searchParams}
      basePath="/new-arrivals"
      listName="new-arrivals"
    />
  );
}
