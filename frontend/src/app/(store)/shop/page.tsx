import type { Metadata } from "next";
import { ListingPage } from "@/components/store/listing/listing-page";
import type { SearchParamsInput } from "@/lib/listing";
import { listingMetadata } from "@/lib/seo";

type Props = { searchParams: Promise<SearchParamsInput> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return listingMetadata({
    title: "Shop All Designs",
    description: "Explore bridal couture, occasionwear and ethnic luxury — lehengas, sarees, gowns, sherwanis and more.",
    path: "/shop",
    searchParams: await searchParams,
  });
}

export default async function ShopPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <ListingPage
      header={{ title: "All Designs", eyebrow: "The Collection", breadcrumbs: [{ name: "Shop" }] }}
      context={{}}
      searchParams={params}
      basePath="/shop"
      listName="shop:all"
    />
  );
}
