"use client";

import { RequirePermission } from "@/components/admin/guard";
import { ProductForm } from "@/components/admin/products/product-form";
import { PageHeader } from "@/components/admin/ui";

export default function NewProductPage() {
  return (
    <RequirePermission permission="products.manage">
      <PageHeader title="New product" breadcrumbs={[{ label: "Products", href: "/admin/products" }, { label: "New" }]} description="Save as a draft at any time. Publishing requires a category, an image and a price (unless priced on request)." />
      <ProductForm />
    </RequirePermission>
  );
}
