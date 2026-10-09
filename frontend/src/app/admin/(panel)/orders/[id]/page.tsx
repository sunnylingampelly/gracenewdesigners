"use client";

import { Info, Lock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RequirePermission } from "@/components/admin/guard";
import { MoneyInput, ShippingFields, shippingPayload, TotalsSummary, type ShippingState } from "@/components/admin/sales/order-form-parts";
import { itemsPayload, itemsSubtotal, newItem, OrderItemsEditor, type ItemDraft } from "@/components/admin/sales/order-items-editor";
import { labelFor, num, Timeline, timelineMeta, useStatusLookups, type Option, type OrderDetail } from "@/components/admin/sales/shared";
import { Badge, Button, Card, ErrorNotice, Field, Input, KeyValue, PageHeader, Select, Spinner, StatusBadge, Textarea, useConfirm } from "@/components/admin/ui";
import { useAuth } from "@/lib/admin/auth";
import { adminApi, useAdminMutation, useAdminQuery, useUnsavedChangesWarning } from "@/lib/admin/hooks";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";

const FIELD_LABELS: Record<string, string> = { status: "Status", payment_status: "Payment" };

export default function OrderDetailPage() {
  return (
    <RequirePermission permission="orders.view">
      <OrderDetailBody />
    </RequirePermission>
  );
}

function useOrderSave(path: string, success: string) {
  return useAdminMutation((body: Record<string, unknown>) => adminApi.patch<{ data: OrderDetail }>(path, body), {
    success,
    invalidate: [["admin", "/admin/orders"], ["admin", path], ["admin", "/admin/enquiries"]],
  });
}

function OrderDetailBody() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const path = `/admin/orders/${id}`;
  const { data, isLoading, error, refetch } = useAdminQuery<{ data: OrderDetail }>(path);
  const { lookups } = useStatusLookups();

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorNotice error={error} onRetry={() => refetch()} />;
  const o = data.data;
  const manage = can("orders.manage");
  const cancelled = o.status === "cancelled";

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Orders", href: "/admin/orders" }, { label: o.reference }]}
        title={<span className="flex flex-wrap items-center gap-3">{o.reference} <StatusBadge status={o.status} label={labelFor(lookups?.order, o.status)} /> <StatusBadge status={o.payment_status} label={labelFor(lookups?.payment, o.payment_status)} /></span>}
        description={
          <>
            Recorded {formatDateTime(o.created_at)}{o.created_by && ` by ${o.created_by}`}
            {o.confirmed_at && <> · Confirmed {formatDateTime(o.confirmed_at)}{o.confirmed_by && ` by ${o.confirmed_by}`}</>}
          </>
        }
      />

      <div className="mb-6 flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <div className="space-y-1">
          <p>Moving an order out of <em>Pending confirmation</em> (to Confirmed or later) <strong>commits stock</strong>: tracked variants are deducted once. Cancelling an order <strong>releases</strong> committed stock back.</p>
          <p>Items can only be edited while stock is not committed. A cancelled order cannot be reopened — record a new order instead.</p>
          <p className="text-xs text-slate-500">Stock: {o.stock_committed ? <Badge tone="blue">Committed</Badge> : <Badge>Not committed</Badge>}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ItemsCard key={`items-${o.items.map((i) => `${i.id}:${i.unit_price}:${i.quantity}`).join(",")}-${o.discount_amount}-${o.shipping_amount}-${o.tax_amount}-${o.stock_committed}`} o={o} path={path} manage={manage && !cancelled} />
          <FulfilmentCard key={`ful-${o.tracking_carrier}-${o.tracking_number}-${o.expected_delivery_date}-${o.shipping_line1}-${o.shipping_name}-${o.requires_shipping}-${o.internal_notes?.length}`} o={o} path={path} manage={manage} />
          <Card title="History">
            <Timeline
              entries={[...o.history].reverse().map((h, i) => {
                const opts: Option[] | undefined = h.field === "payment_status" ? lookups?.payment : lookups?.order;
                return {
                  key: i,
                  title: (
                    <>
                      <span className="text-slate-500">{FIELD_LABELS[h.field ?? ""] ?? h.field}:</span>{" "}
                      {h.from ? <>{labelFor(opts, h.from)} → </> : null}
                      <strong className="font-medium">{labelFor(opts, h.to)}</strong>
                    </>
                  ),
                  body: h.note,
                  meta: timelineMeta(h.user, h.created_at),
                };
              })}
              empty="No history yet."
            />
          </Card>
        </div>
        <div className="space-y-6">
          <StatusCard key={`st-${o.status}-${o.payment_status}-${o.amount_paid}-${o.payment_note}`} o={o} path={path} manage={manage} statusOptions={lookups?.order} paymentOptions={lookups?.payment} />
          <Card title="Linked records">
            <KeyValue
              items={[
                ["Enquiry", o.enquiry ? <Link key="e" href={`/admin/enquiries/${o.enquiry.id}`} className="text-royal hover:underline">{o.enquiry.reference}</Link> : "None"],
                ["Customer", o.customer ? (can("customers.view") ? <Link key="c" href={`/admin/customers/${o.customer.id}`} className="text-royal hover:underline">{o.customer.name ?? `Customer #${o.customer.id}`}</Link> : o.customer.name) : "Not linked"],
                ...(o.customer?.phone ? [["Phone", o.customer.phone] as [string, string]] : []),
                ...(o.customer?.email ? [["Email", o.customer.email] as [string, string]] : []),
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}

function ItemsCard({ o, path, manage }: { o: OrderDetail; path: string; manage: boolean }) {
  const editableItems = manage && !o.stock_committed;
  const [items, setItems] = useState<ItemDraft[]>(() =>
    o.items.map((i) => newItem({
      product_id: i.product_id,
      product_variant_id: i.product_variant_id,
      product_title: i.product_id ? i.product_name : null,
      product_name: i.product_name,
      size_label: i.size_label ?? "",
      color_label: i.color_label ?? "",
      is_custom_size: i.is_custom_size,
      quantity: String(i.quantity),
      unit_price: String(num(i.unit_price)),
      notes: i.notes ?? "",
    })),
  );
  const initialCharges = { discount_amount: String(num(o.discount_amount)), shipping_amount: String(num(o.shipping_amount)), tax_amount: String(num(o.tax_amount)) };
  const [charges, setCharges] = useState(initialCharges);
  const [dirty, setDirty] = useState(false);
  useUnsavedChangesWarning(dirty);
  const save = useOrderSave(path, "Items and charges saved");

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    save.mutate({
      ...(editableItems ? { items: itemsPayload(items) } : {}),
      discount_amount: num(charges.discount_amount),
      shipping_amount: num(charges.shipping_amount),
      tax_amount: num(charges.tax_amount),
    });
  };
  const subtotal = editableItems ? itemsSubtotal(items) : num(o.subtotal);

  return (
    <Card
      title="Items & charges"
      description={o.stock_committed ? <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" aria-hidden /> Items are locked because stock has been committed. Cancel and re-create the order to change them.</span> : manage ? "Items can be edited until the order is confirmed." : undefined}
    >
      <form onSubmit={submit} onChange={() => setDirty(true)} className="space-y-5">
        {editableItems ? (
          <OrderItemsEditor items={items} onChange={(v) => { setItems(v); setDirty(true); }} fieldError={save.fieldError} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                <tr><th className="py-2 pr-3 font-medium">Item</th><th className="py-2 pr-3 font-medium">Size / colour</th><th className="py-2 pr-3 text-right font-medium">Qty</th><th className="py-2 pr-3 text-right font-medium">Unit</th><th className="py-2 text-right font-medium">Line</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {o.items.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2 pr-3">
                      {i.product_id ? <Link href={`/admin/products/${i.product_id}`} className="font-medium hover:underline">{i.product_name}</Link> : <span className="font-medium">{i.product_name}</span>}
                      <span className="block text-xs text-slate-500">{i.sku ?? "No SKU"}{i.notes && ` · ${i.notes}`}</span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{i.is_custom_size ? "Custom size" : i.size_label ?? "—"}{i.color_label && ` / ${i.color_label}`}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{i.quantity}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(i.unit_price, o.currency)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(i.line_total, o.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-5 border-t border-slate-100 pt-5 md:grid-cols-2">
          <fieldset disabled={!manage} className="grid grid-cols-3 gap-3 self-start">
            <legend className="sr-only">Charges</legend>
            <Field label="Discount (₹)" htmlFor="o-discount" error={save.fieldError("discount_amount")}><MoneyInput id="o-discount" value={charges.discount_amount} onChange={(v) => setCharges({ ...charges, discount_amount: v })} /></Field>
            <Field label="Shipping (₹)" htmlFor="o-shipping" error={save.fieldError("shipping_amount")}><MoneyInput id="o-shipping" value={charges.shipping_amount} onChange={(v) => setCharges({ ...charges, shipping_amount: v })} /></Field>
            <Field label="Tax (₹)" htmlFor="o-tax" error={save.fieldError("tax_amount")}><MoneyInput id="o-tax" value={charges.tax_amount} onChange={(v) => setCharges({ ...charges, tax_amount: v })} /></Field>
          </fieldset>
          <div className="rounded-md bg-slate-50 p-4">
            <TotalsSummary subtotal={subtotal} discount={num(charges.discount_amount)} shipping={num(charges.shipping_amount)} tax={num(charges.tax_amount)} paid={num(o.amount_paid)} currency={o.currency} />
            {dirty && <p className="mt-2 text-xs text-slate-500">Totals preview — saved total is {formatMoney(o.total, o.currency)}.</p>}
          </div>
        </div>
        {manage && (
          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending} disabled={!dirty}>Save items & charges</Button>
          </div>
        )}
      </form>
    </Card>
  );
}

function StatusCard({ o, path, manage, statusOptions, paymentOptions }: { o: OrderDetail; path: string; manage: boolean; statusOptions?: Option[]; paymentOptions?: Option[] }) {
  const initial = { status: o.status, payment_status: o.payment_status, amount_paid: String(num(o.amount_paid)), payment_note: o.payment_note ?? "" };
  const [form, setForm] = useState({ ...initial, status_note: "" });
  const dirty = form.status !== initial.status || form.payment_status !== initial.payment_status || form.amount_paid !== initial.amount_paid || form.payment_note !== initial.payment_note || !!form.status_note.trim();
  useUnsavedChangesWarning(dirty);
  const save = useOrderSave(path, "Order updated");
  const { confirm, dialog } = useConfirm();

  const send = () => {
    const body: Record<string, unknown> = {};
    if (form.status !== initial.status) body.status = form.status;
    if (form.payment_status !== initial.payment_status) body.payment_status = form.payment_status;
    if (form.amount_paid !== initial.amount_paid) body.amount_paid = num(form.amount_paid);
    if (form.payment_note !== initial.payment_note) body.payment_note = form.payment_note.trim() || null;
    if (form.status_note.trim()) body.status_note = form.status_note.trim();
    return save.mutateAsync(body).catch(() => undefined);
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!dirty) return;
    const changing = form.status !== initial.status;
    if (changing && form.status === "cancelled") {
      confirm({ title: `Cancel ${o.reference}?`, description: <>Committed stock will be released back to inventory. <strong>A cancelled order cannot be reopened.</strong></>, confirmLabel: "Cancel order", destructive: true, action: send });
    } else if (changing && !o.stock_committed && form.status !== "pending_confirmation") {
      confirm({ title: `Confirm ${o.reference}?`, description: "This commits stock: tracked variants on this order will be deducted. Items can no longer be edited afterwards.", confirmLabel: "Confirm & commit stock", action: send });
    } else {
      void send();
    }
  };

  const balance = Math.max(0, num(o.total) - num(form.amount_paid));

  return (
    <Card title="Status & payment">
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={!manage} className="space-y-4">
          <Field label="Order status" htmlFor="o-status" error={save.fieldError("status")} hint={o.status === "cancelled" ? "This order is cancelled and cannot be reopened." : undefined}>
            <Select id="o-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} invalid={!!save.fieldError("status")}>
              {(statusOptions ?? [{ value: o.status, label: labelFor(undefined, o.status) }]).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Payment status" htmlFor="o-pay" error={save.fieldError("payment_status")} hint="Recorded manually — the platform never infers payment.">
            <Select id="o-pay" value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}>
              {(paymentOptions ?? [{ value: o.payment_status, label: labelFor(undefined, o.payment_status) }]).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Amount paid (₹)" htmlFor="o-paid" error={save.fieldError("amount_paid")} hint={<>Total {formatMoney(o.total, o.currency)} · balance due <span className={balance > 0 ? "font-medium text-amber-800" : "font-medium text-emerald-700"}>{formatMoney(balance, o.currency)}</span></>}>
            <MoneyInput id="o-paid" value={form.amount_paid} onChange={(v) => setForm({ ...form, amount_paid: v })} />
          </Field>
          <Field label="Payment note" htmlFor="o-pay-note" error={save.fieldError("payment_note")}>
            <Input id="o-pay-note" value={form.payment_note} onChange={(e) => setForm({ ...form, payment_note: e.target.value })} maxLength={500} />
          </Field>
          <Field label="Note for history" htmlFor="o-status-note" hint="Saved with status or payment status changes." error={save.fieldError("status_note")}>
            <Textarea id="o-status-note" rows={2} value={form.status_note} onChange={(e) => setForm({ ...form, status_note: e.target.value })} maxLength={1000} />
          </Field>
        </fieldset>
        {manage && (
          <div className="flex justify-end gap-2">
            {dirty && <Button variant="ghost" onClick={() => { setForm({ ...initial, status_note: "" }); save.setFieldErrors({}); }}>Reset</Button>}
            <Button type="submit" loading={save.isPending} disabled={!dirty}>Update order</Button>
          </div>
        )}
      </form>
      {dialog}
    </Card>
  );
}

function FulfilmentCard({ o, path, manage }: { o: OrderDetail; path: string; manage: boolean }) {
  const [shipping, setShipping] = useState<ShippingState>({
    requires_shipping: o.requires_shipping,
    shipping_name: o.shipping_name ?? "",
    shipping_phone: o.shipping_phone ?? "",
    shipping_line1: o.shipping_line1 ?? "",
    shipping_line2: o.shipping_line2 ?? "",
    shipping_city: o.shipping_city ?? "",
    shipping_state: o.shipping_state ?? "",
    shipping_postal_code: o.shipping_postal_code ?? "",
    shipping_country: o.shipping_country ?? "",
  });
  const [form, setForm] = useState({ tracking_carrier: o.tracking_carrier ?? "", tracking_number: o.tracking_number ?? "", expected_delivery_date: o.expected_delivery_date ?? "", internal_notes: o.internal_notes ?? "" });
  const [dirty, setDirty] = useState(false);
  useUnsavedChangesWarning(dirty);
  const save = useOrderSave(path, "Fulfilment details saved");

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    save.mutate({
      ...shippingPayload(shipping),
      tracking_carrier: form.tracking_carrier.trim() || null,
      tracking_number: form.tracking_number.trim() || null,
      expected_delivery_date: form.expected_delivery_date || null,
      internal_notes: form.internal_notes.trim() || null,
    });
  };

  return (
    <Card title="Fulfilment & notes">
      <form onSubmit={submit} onChange={() => setDirty(true)} className="space-y-5">
        <fieldset disabled={!manage} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Expected delivery" htmlFor="o-delivery" error={save.fieldError("expected_delivery_date")} hint={o.expected_delivery_date ? formatDate(o.expected_delivery_date) : undefined}>
              <Input id="o-delivery" type="date" value={form.expected_delivery_date} onChange={(e) => setForm({ ...form, expected_delivery_date: e.target.value })} />
            </Field>
            <Field label="Tracking carrier" htmlFor="o-carrier" error={save.fieldError("tracking_carrier")}>
              <Input id="o-carrier" value={form.tracking_carrier} onChange={(e) => setForm({ ...form, tracking_carrier: e.target.value })} maxLength={100} placeholder="e.g. Blue Dart" />
            </Field>
            <Field label="Tracking number" htmlFor="o-tracking" error={save.fieldError("tracking_number")}>
              <Input id="o-tracking" value={form.tracking_number} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} maxLength={100} />
            </Field>
          </div>
          <ShippingFields idPrefix="o" value={shipping} onChange={(v) => { setShipping(v); setDirty(true); }} fieldError={save.fieldError} />
          <Field label="Internal notes" htmlFor="o-notes" error={save.fieldError("internal_notes")}>
            <Textarea id="o-notes" rows={4} value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} maxLength={5000} />
          </Field>
        </fieldset>
        {manage && (
          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending} disabled={!dirty}>Save fulfilment details</Button>
          </div>
        )}
      </form>
    </Card>
  );
}
