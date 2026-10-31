import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi } from '../../api/client';
import { ArrowLeft, Printer, XCircle } from 'lucide-react';
import { format } from 'date-fns';

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const STATUS_COLORS = {
  draft:    'bg-gray-100 text-gray-600',
  posted:   'bg-blue-100 text-blue-700',
  paid:     'bg-green-100 text-green-700',
  partial:  'bg-amber-100 text-amber-700',
  void:     'bg-red-100 text-red-700',
  refunded: 'bg-purple-100 text-purple-700',
};

const PAYMENT_MODE_COLORS = {
  cash:   'bg-green-50 text-green-700',
  card:   'bg-blue-50 text-blue-700',
  upi:    'bg-indigo-50 text-indigo-700',
  cheque: 'bg-amber-50 text-amber-700',
};

export default function SaleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: bill, isLoading, error } = useQuery({
    queryKey: ['sale', id],
    queryFn:  () => salesApi.get(id).then(r => r.data),
  });

  const voidMutation = useMutation({
    mutationFn: () => salesApi.void(id, { reason: window.prompt('Reason for voiding this bill?') || 'Voided by admin' }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['sale', id] }),
  });

  if (isLoading) return <div className="p-8 text-gray-400">Loading bill…</div>;
  if (error || !bill) return <div className="p-8 text-red-500">Bill not found.</div>;

  const customer = bill.customer?.name ?? bill.walk_in_name ?? 'Walk-in';
  const phone    = bill.customer?.phone ?? bill.walk_in_phone ?? '—';

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <button onClick={() => navigate('/admin/sales')} className="text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold font-mono">{bill.bill_number}</h1>
            <span className={`badge ${STATUS_COLORS[bill.status] ?? 'bg-gray-100 text-gray-500'}`}>{bill.status}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(new Date(bill.bill_date), 'd MMMM yyyy')} · Created by {bill.creator?.name ?? '—'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2 text-xs">
            <Printer size={14} /> Print
          </button>
          {bill.status !== 'void' && bill.status !== 'refunded' && (
            <button onClick={() => voidMutation.mutate()}
              disabled={voidMutation.isPending}
              className="flex items-center gap-2 text-xs border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded px-3 py-1.5 transition-colors">
              <XCircle size={14} /> Void Bill
            </button>
          )}
        </div>
      </div>

      {/* Customer & Meta */}
      <div className="grid md:grid-cols-2 gap-4 mb-5">
        <div className="card space-y-2">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</h2>
          <p className="font-medium">{customer}</p>
          <p className="text-sm text-gray-500">{phone}</p>
          {bill.customer?.email && <p className="text-sm text-gray-400">{bill.customer.email}</p>}
        </div>
        <div className="card space-y-2">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bill Details</h2>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Bill Date</span>
            <span>{format(new Date(bill.bill_date), 'd MMM yyyy')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Created By</span>
            <span>{bill.creator?.name ?? '—'}</span>
          </div>
          {bill.notes && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Notes</span>
              <span className="text-right max-w-[200px]">{bill.notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="card p-0 overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-medium text-gray-700">Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2 text-right w-16">Qty</th>
                <th className="px-4 py-2 text-right w-24">Price</th>
                <th className="px-4 py-2 text-right w-20">Disc%</th>
                <th className="px-4 py-2 text-right w-24">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bill.line_items?.map((item, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.variant?.product?.name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{item.variant?.sku} {item.variant?.size ? `· ${item.variant.size}` : ''}</p>
                  </td>
                  <td className="px-4 py-3 text-right">{item.quantity}</td>
                  <td className="px-4 py-3 text-right">{fmt(item.unit_price)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{item.discount_percent > 0 ? `${item.discount_percent}%` : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-gray-100 px-4 py-3 flex flex-col items-end gap-1 text-sm">
          <div className="flex gap-16">
            <span className="text-gray-500">Subtotal</span>
            <span>{fmt(bill.subtotal)}</span>
          </div>
          {bill.discount_amount > 0 && (
            <div className="flex gap-16">
              <span className="text-gray-500">Discount</span>
              <span className="text-red-600">− {fmt(bill.discount_amount)}</span>
            </div>
          )}
          {bill.tax_amount > 0 && (
            <div className="flex gap-16">
              <span className="text-gray-500">Tax</span>
              <span>{fmt(bill.tax_amount)}</span>
            </div>
          )}
          <div className="flex gap-16 font-semibold text-base border-t border-gray-100 pt-1 mt-1 w-full justify-end">
            <span>Total</span>
            <span>{fmt(bill.total_amount)}</span>
          </div>
          <div className="flex gap-16 text-green-700">
            <span>Paid</span>
            <span>{fmt(bill.amount_paid)}</span>
          </div>
          {bill.amount_due > 0 && (
            <div className="flex gap-16 text-red-700 font-medium">
              <span>Due</span>
              <span>{fmt(bill.amount_due)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Payments */}
      {bill.payments?.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-medium text-gray-700">Payments</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase text-left">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Mode</th>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bill.payments.map((p, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-gray-500">{format(new Date(p.payment_date ?? p.created_at), 'd MMM yy')}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${PAYMENT_MODE_COLORS[p.mode] ?? 'bg-gray-100 text-gray-600'}`}>{p.mode}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-400 font-mono text-xs">{p.reference ?? '—'}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmt(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
