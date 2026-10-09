import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { crumbsFrom, ListingPage } from "@/components/store/listing/listing-page";
import { api } from "@/lib/api-server";
import type { SearchParamsInput } from "@/lib/listing";
import { listingMetadata } from "@/lib/seo";
import { mediaUrl } from "@/lib/utils";

type Props = { params: Promise<{ path: string[] }>; searchParams: Promise<SearchParamsInput> };

/** /shop/{department} or /shop/{department}/{category}/{subcategory…} */
async function load(segments: string[]) {
  const safe = segments.every((s) => /^[a-z0-9-]+$/.test(s));
  if (!safe || segments.length > 5) return null;
  return segments.length === 1 ? api.department(segments[0]) : api.category(segments.join("/"));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { path } = await params;
  const context = await load(path);
  if (!context) return { title: "Not found" };
  return listingMetadata({
    title: context.seo.title,
    description: context.seo.description,
    path: `/shop/${path.join("/")}`,
    searchParams: await searchParams,
    image: mediaUrl(context.banner, "lg"),
  });
}

export default async function DepartmentOrCategoryPage({ params, searchParams }: Props) {
  const { path } = await params;
  const [context, query] = await Promise.all([load(path), searchParams]);
  if (!context) notFound();

  const isDepartment = context.type === "department";
  const crumbs = crumbsFrom(context.breadcrumbs);

  return (
    <ListingPage
      header={{
        title: context.name,
        eyebrow: isDepartment ? "Shop" : context.breadcrumbs?.[0]?.name,
        intro: context.intro,
        banner: context.banner,
        breadcrumbs: crumbs.map((c, i) => (i === crumbs.length - 1 ? { name: c.name } : c)),
        children: context.children,
      }}
      context={isDepartment ? { department: context.slug } : { category: context.path }}
      searchParams={query}
      basePath={`/shop/${path.join("/")}`}
      listName={`${context.type}:${context.path ?? context.slug}`}
    />
  );
}
