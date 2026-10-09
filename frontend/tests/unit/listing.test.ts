import { describe, expect, it } from "vitest";
import { activeFilterCount, buildListingQuery, facetQuery, isRefined } from "@/lib/listing";
import { listingMetadata } from "@/lib/seo";

describe("listing query", () => {
  it("combines page context with whitelisted filters only", () => {
    const q = buildListingQuery({ category: "women/lehengas" }, { size: "m,l", color: "navy-blue", "attr[fabric]": "silk", evil: "1", page: "2", sort: "price_asc" });
    expect(q.get("category")).toBe("women/lehengas");
    expect(q.get("size")).toBe("m,l");
    expect(q.get("attr[fabric]")).toBe("silk");
    expect(q.get("evil")).toBeNull();
    expect(q.get("page")).toBe("2");
    expect(q.get("sort")).toBe("price_asc");
    expect(q.get("per_page")).toBe("24");
  });

  it("ignores unknown sorts and invalid pages", () => {
    const q = buildListingQuery({ sort: "newest" }, { sort: "drop table", page: "-4" });
    expect(q.get("sort")).toBe("newest");
    expect(q.get("page")).toBeNull();
  });

  it("strips pagination and sort from facet queries", () => {
    const q = facetQuery(buildListingQuery({ department: "women" }, { sort: "newest", page: "3", size: "s" }));
    expect(q.toString()).toBe("department=women&size=s");
  });

  it("counts active filters", () => {
    expect(activeFilterCount({ size: "s,m", color: "navy", price_min: "100", price_max: "900", sort: "newest" })).toBe(4);
  });
});

describe("listing SEO", () => {
  it("keeps the canonical on the unfiltered page and noindexes refinements", () => {
    const meta = listingMetadata({ title: "Lehengas", path: "/shop/women/lehengas", searchParams: { size: "m" } });
    expect(meta.alternates?.canonical).toMatch(/\/shop\/women\/lehengas$/);
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(isRefined({ page: "2" })).toBe(false);
  });

  it("self-canonicalises deep pagination of unfiltered listings", () => {
    const meta = listingMetadata({ title: "Lehengas", path: "/shop/women/lehengas", searchParams: { page: "2" } });
    expect(meta.alternates?.canonical).toMatch(/\/shop\/women\/lehengas\?page=2$/);
    expect(meta.robots).toBeUndefined();
  });
});
