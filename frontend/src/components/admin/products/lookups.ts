"use client";

import { useAdminQuery } from "@/lib/admin/hooks";

export type OptionValue = { id: number; product_option_id: number; label: string; code: string; hex: string | null; size_group: string | null; is_custom: boolean; sort_order: number };
export type Option = { id: number; name: string; code: "size" | "color"; values: OptionValue[] };
export type CategoryRow = { id: number; department_id: number; parent_id: number | null; name: string; path: string; depth: number; is_published: boolean; attribute_ids: number[] };
export type Attribute = { id: number; name: string; code: string; type: "text" | "textarea" | "select" | "multiselect" | "boolean"; group: string; is_filterable: boolean; values: { id: number; value: string }[]; category_ids: number[] };

/** Reference data needed by the product editor, loaded once and cached by react-query. */
export function useCatalogLookups() {
  const departments = useAdminQuery<{ data: { id: number; name: string; slug: string }[] }>("/admin/departments");
  const categories = useAdminQuery<{ data: CategoryRow[] }>("/admin/categories");
  const collections = useAdminQuery<{ data: { id: number; name: string; is_published: boolean }[] }>("/admin/collections");
  const occasions = useAdminQuery<{ data: { id: number; name: string }[] }>("/admin/occasions");
  const options = useAdminQuery<{ data: Option[] }>("/admin/options");
  const attributes = useAdminQuery<{ data: Attribute[] }>("/admin/attributes");
  const sizeCharts = useAdminQuery<{ data: { id: number; name: string }[] }>("/admin/size-charts");

  const sizeOption = options.data?.data.find((o) => o.code === "size");
  const colorOption = options.data?.data.find((o) => o.code === "color");

  return {
    loading: [departments, categories, collections, occasions, options, attributes, sizeCharts].some((q) => q.isLoading),
    departments: departments.data?.data ?? [],
    categories: categories.data?.data ?? [],
    collections: collections.data?.data ?? [],
    occasions: occasions.data?.data ?? [],
    sizes: (sizeOption?.values ?? []).filter((v) => !v.is_custom),
    colors: colorOption?.values ?? [],
    attributes: attributes.data?.data ?? [],
    sizeCharts: sizeCharts.data?.data ?? [],
  };
}
