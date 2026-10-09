"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { CustomerPicker, type PickedCustomer } from "@/components/admin/sales/customer-picker";
import { EMPTY_SHIPPING, MoneyInput, ShippingFields, shippingPayload, TotalsSummary, type ShippingState } from "@/components/admin/sales/order-form-parts";
import { itemsPayload, itemsSubtotal, newItem, OrderItemsEditor, type ItemDraft } from "@/components/admin/sales/order-items-editor";
import { num, useStatusLookups, type EnquiryDetail, type OrderDetail } from "@/components/admin/sales/shared";
import { Button, Card, ErrorNotice, Field, Input, PageHeader, Select, Spinner, Textarea } from "@/components/admin/ui";
import { adminApi, useAdminMutation, useAdminQuery, useUnsavedChangesWarning } from "@/lib/admin/hooks";

type Draft = {
  enquiry_id: number;
  customer_id: number | null;
  currency: string;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_city: string | null;
  shipping_country: string | null;
  items: { product_id: number | null; product_variant_id: number | null; product_name: string; size_label: string | null; color_label: string | null; is_custom_size: boolean; quantity: number; unit_price: string | null }[];
};

export default function NewOrderPage() {
  return (
    <RequirePermission permission="orders.manage">
      <Suspense fallback={<Spinner />}>
        <NewOrderLoader />
      </Suspense>
    </RequirePermission>
  );
}

function NewOrderLoader() {
  const params = useSearchParams();
  const enquiryId = params.get("enquiry");
  const draft = useAdminQuery<{ data: Draft }>(enquiryId ? `/admin/enquiries/${enquiryId}/order-draft` : null);
  const enquiry = useAdminQuery<{ data: EnquiryDetail }>(enquiryId ? `/admin/enquiries/${enquiryId}` : null);

  if (enquiryId && (draft.isLoading || enquiry.isLoading)) return <Spinner label="Loading enquiry" />;
  if (enquiryId && (draft.error || !draft.data)) return <ErrorNotice error={draft.error} onRetry={() => draft.refetch()} />;

  const e = enquiry.data?.data ?? null;
  if (e?.order) {
    return (
      <>
        <PageHeader title="New order" breadcrumbs={[{ label: "Orders", href: "/admin/orders" }, { label: "New" }]} />
        <Card>
          <p className="text-sm text-slate-700">
            Enquiry {e.reference} already has an order: <Link href={`/admin/orders/${e.order.id}`} className="font-medium text-royal hover:underline">{e.order.reference}</Link>.
          </p>
        </Card>
      </>
    );
  }
  return <NewOrderForm key={enquiryId ?? "blank"} draft={draft.data?.data ?? null} enquiry={e} />;
}

function NewOrderForm({ draft, enquiry }: { draft: Draft | null; enquiry: EnquiryDetail | null }) {
  const router = useRouter();
  const { lookups } = useStatusLookups();
  const [customer, setCustomer] = useState<PickedCustomer | null>(() =>
    draft?.customer_id ? (enquiry?.customer?.id === draft.customer_id ? { id: enquiry.customer.id, name: enquiry.customer.name, phone: enquiry.customer.phone, email: enquiry.customer.email } : { id: draft.customer_id, name: null, phone: null, email: null }) : null,
  );
  const [items, setItems] = useState<ItemDraft[]>(() =>
    draft?.items.length
      ? draft.items.map((i) => newItem({
          product_id: i.product_id,
          product_variant_id: i.product_variant_id,
          product_title: i.product_id ? i.product_name : null,
          product_name: i.product_name,
          size_label: i.size_label ?? "",
          color_label: i.color_label ?? "",
          is_custom_size: i.is_custom_size,
          quantity: String(i.quantity),
          unit_price: "",
          displayed_price: i.unit_price,
        }))
      : [newItem()],
  );
  const [charges, setCharges] = useState({ discount_amount: "", shipping_amount: "", tax_amount: "" });
  const [payment, setPayment] = useState({ payment_status: "unpaid", amount_paid: "", payment_note: "" });
  const [shipping, setShipping] = useState<ShippingState>({
    ...EMPTY_SHIPPING,
    shipping_name: draft?.shipping_name ?? "",
    shipping_phone: draft?.shipping_phone ?? "",
    shipping_city: draft?.shipping_city ?? "",
    shipping_country: draft?.shipping_country ?? EMPTY_SHIPPING.shipping_country,
  });
  const [meta, setMeta] = useState({ expected_delivery_date: "", internal_notes: "", status: "pending_confirmation" });
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  useUnsavedChangesWarning(touched && !submitted);

  const create = useAdminMutation((body: Record<string, unknown>) => adminApi.post<{ data: OrderDetail }>("/admin/orders", body), {
    success: (r) => `Order ${r.data.reference} recorded`,
    invalidate: [["admin", "/admin/orders"], ["admin", "/admin/enquiries"], ...(enquiry ? [["admin", `/admin/enquiries/${enquiry.id}`]] : [])],
    onSuccess: (r) => { setSubmitted(true); router.push(`/admin/orders/${r.data.id}`); },
  });
  const fe = create.fieldError;

  const subtotal = itemsSubtotal(items);
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    create.mutate({
      enquiry_id: draft?.enquiry_id ?? null,
      customer_id: customer?.id ?? null,
      currency: draft?.currency ?? "INR",
      status: meta.status,
      items: itemsPayload(items),
      discount_amount: num(charges.discount_amount),
      shipping_amount: num(charges.shipping_amount),
      tax_amount: num(charges.tax_amount),
      payment_status: payment.payment_status,
      amount_paid: num(payment.amount_paid),
      payment_note: payment.payment_note.trim() || null,
      ...shippingPayload(shipping),
      expected_delivery_date: meta.expected_delivery_date || null,
      internal_notes: meta.internal_notes.trim() || null,
    });
  };

  return (
    <form onSubmit={submit} onChange={() => setTouched(true)} noValidate>
      <PageHeader
        breadcrumbs={[{ label: "Orders", href: "/admin/orders" }, { label: "New order" }]}
        title="Record an order"
        description="Record an order agreed with the customer over WhatsApp. Nothing is charged here — payments are recorded manually."
        actions={<Button type="submit" loading={create.isPending}>Save order</Button>}
      />

      {enquiry && (
        <p className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Prefilled from enquiry <Link href={`/admin/enquiries/${enquiry.id}`} className="font-medium underline">{enquiry.reference}</Link>. Prices shown on the site are hints only — enter the unit price actually agreed with the customer for every item.
        </p>
      )}
      {fe("enquiry_id") && <p className="mb-4 text-sm text-red-700" role="alert">{fe("enquiry_id")}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Customer">
            <CustomerPicker value={customer} onChange={setCustomer} error={fe("customer_id")} />
          </Card>
          <Card title="Items" description="Link catalogue products where possible so confirmed orders keep stock accurate. Use a free-text name for bespoke pieces.">
            <OrderItemsEditor items={items} onChange={setItems} fieldError={fe} />
          </Card>
          <Card title="Shipping">
            <ShippingFields idPrefix="new" value={shipping} onChange={setShipping} fieldError={fe} />
          </Card>
          <Card title="Internal notes">
            <Field label="Notes for the team" htmlFor="new-notes" error={fe("internal_notes")}>
              <Textarea id="new-notes" rows={4} value={meta.internal_notes} onChange={(e) => setMeta({ ...meta, internal_notes: e.target.value })} maxLength={5000} />
            </Field>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Status">
            <fieldset className="space-y-3">
              <legend className="sr-only">Initial status</legend>
              {[
                { value: "pending_confirmation", label: "Pending confirmation", hint: "Details still being confirmed. No stock is deducted." },
                { value: "confirmed", label: "Confirmed", hint: "Confirms now and deducts stock for tracked variants. Fails if stock is insufficient." },
              ].map((o) => (
                <label key={o.value} className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 text-sm has-[:checked]:border-slate-900">
                  <input type="radio" name="initial-status" value={o.value} checked={meta.status === o.value} onChange={() => setMeta({ ...meta, status: o.value })} className="mt-0.5 accent-slate-900" />
                  <span><span className="font-medium text-slate-900">{o.label}</span><span className="block text-xs text-slate-500">{o.hint}</span></span>
                </label>
              ))}
              {fe("status") && <p className="text-xs text-red-700" role="alert">{fe("status")}</p>}
            </fieldset>
            <Field label="Expected delivery" htmlFor="new-delivery" error={fe("expected_delivery_date")} className="mt-4">
              <Input id="new-delivery" type="date" value={meta.expected_delivery_date} onChange={(e) => setMeta({ ...meta, expected_delivery_date: e.target.value })} />
            </Field>
          </Card>

          <Card title="Charges & payment">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Discount (₹)" htmlFor="new-discount" error={fe("discount_amount")}><MoneyInput id="new-discount" value={charges.discount_amount} onChange={(v) => setCharges({ ...charges, discount_amount: v })} /></Field>
              <Field label="Shipping (₹)" htmlFor="new-shipping" error={fe("shipping_amount")}><MoneyInput id="new-shipping" value={charges.shipping_amount} onChange={(v) => setCharges({ ...charges, shipping_amount: v })} /></Field>
              <Field label="Tax (₹)" htmlFor="new-tax" error={fe("tax_amount")}><MoneyInput id="new-tax" value={charges.tax_amount} onChange={(v) => setCharges({ ...charges, tax_amount: v })} /></Field>
              <Field label="Amount paid (₹)" htmlFor="new-paid" error={fe("amount_paid")}><MoneyInput id="new-paid" value={payment.amount_paid} onChange={(v) => setPayment({ ...payment, amount_paid: v })} /></Field>
            </div>
            <Field label="Payment status" htmlFor="new-pay-status" error={fe("payment_status")} className="mt-3">
              <Select id="new-pay-status" value={payment.payment_status} onChange={(e) => setPayment({ ...payment, payment_status: e.target.value })}>
                {(lookups?.payment ?? [{ value: "unpaid", label: "Unpaid" }]).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Payment note" htmlFor="new-pay-note" hint="e.g. UPI reference, bank transfer date." error={fe("payment_note")} className="mt-3">
              <Input id="new-pay-note" value={payment.payment_note} onChange={(e) => setPayment({ ...payment, payment_note: e.target.value })} maxLength={500} />
            </Field>
            <div className="mt-5 rounded-md bg-slate-50 p-4">
              <TotalsSummary subtotal={subtotal} discount={num(charges.discount_amount)} shipping={num(charges.shipping_amount)} tax={num(charges.tax_amount)} paid={num(payment.amount_paid)} currency={draft?.currency ?? "INR"} />
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Save order</Button>
          </div>
        </div>
      </div>
    </form>
  );
}
