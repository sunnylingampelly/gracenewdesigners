"use client";

import { useParams } from "next/navigation";
import { RequirePermission } from "@/components/admin/guard";
import { ProductForm } from "@/components/admin/products/product-form";
import type { AdminProduct } from "@/components/admin/products/types";
import { ErrorNotice, PageHeader, Spinner } from "@/components/admin/ui";
import { useAdminQuery } from "@/lib/admin/hooks";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: AdminProduct }>(`/admin/products/${id}`);

  return (
    <RequirePermission permission="products.view">
      <PageHeader title={data?.data.name ?? "Product"} breadcrumbs={[{ label: "Products", href: "/admin/products" }, { label: data?.data.sku ?? `#${id}` }]} />
      {isLoading ? <Spinner /> : error || !data ? <ErrorNotice error={error} onRetry={() => refetch()} /> : <ProductForm product={data.data} />}
    </RequirePermission>
  );
}
