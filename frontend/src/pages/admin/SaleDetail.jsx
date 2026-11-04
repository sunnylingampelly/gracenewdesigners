import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi, modificationRequestsApi } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { ArrowLeft, Printer, XCircle, MessageSquare, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
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

const MOD_STATUS = {
  pending:   { icon: Clock,        color: 'text-amber-600 bg-amber-50 border-amber-200' },
  approved:  { icon: CheckCircle2, color: 'text-green-700 bg-green-50 border-green-200' },
  rejected:  { icon: XCircle,      color: 'text-red-600 bg-red-50 border-red-200'       },
  completed: { icon: CheckCircle2, color: 'text-blue-700 bg-blue-50 border-blue-200'    },
};

export default function SaleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { user, hasPermission } = useAuthStore();
  const isAdmin = user?.role === 'super_admin' || hasPermission('users');

  const [showModModal, setShowModModal] = useState(false);
  const [modReason, setModReason]       = useState('');
  const [adminNotes, setAdminNotes]     = useState({});

  const { data: bill, isLoading, error } = useQuery({
    queryKey: ['sale', id],
    queryFn:  () => salesApi.get(id).then(r => r.data),
  });

  const { data: modRequests = [] } = useQuery({
    queryKey: ['mod-requests', id],
    queryFn:  () => modificationRequestsApi.forBill(id).then(r => r.data),
    enabled:  !!id,
  });

  const voidMutation = useMutation({
    mutationFn: () => salesApi.void(id, { reason: window.prompt('Reason for voiding this bill?') || 'Voided by admin' }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['sale', id] }),
  });

  const submitModMutation = useMutation({
    mutationFn: () => modificationRequestsApi.create(id, { reason: modReason }),
    onSuccess:  () => {
      setShowModModal(false);
      setModReason('');
      qc.invalidateQueries({ queryKey: ['mod-requests', id] });
    },
  });

  const reviewModMutation = useMutation({
    mutationFn: ({ reqId, status, notes }) =>
      modificationRequestsApi.update(reqId, { status, admin_notes: notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod-requests', id] }),
  });

  if (isLoading) return <div className="p-8 text-gray-400">Loading bill…</div>;
  if (error || !bill) return <div className="p-8 text-red-500">Bill not found.</div>;

  const customer      = bill.customer?.name ?? bill.walk_in_name ?? 'Walk-in';
  const phone         = bill.customer?.phone ?? bill.walk_in_phone ?? '—';
  const hasPending    = modRequests.some(r => r.status === 'pending');
  const canVoid       = bill.status !== 'void' && bill.status !== 'refunded';

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
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2 text-xs">
            <Printer size={14} /> Print
          </button>

          {/* Admin: Void Bill */}
          {isAdmin && canVoid && (
            <button onClick={() => voidMutation.mutate()}
              disabled={voidMutation.isPending}
              className="flex items-center gap-2 text-xs border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded px-3 py-1.5 transition-colors">
              <XCircle size={14} /> Void Bill
            </button>
          )}

          {/* Staff: Request Modification */}
          {!isAdmin && canVoid && !hasPending && (
            <button onClick={() => setShowModModal(true)}
              className="flex items-center gap-2 text-xs border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded px-3 py-1.5 transition-colors">
              <MessageSquare size={14} /> Request Modification
            </button>
          )}

          {/* Staff: Pending indicator */}
          {!isAdmin && hasPending && (
            <span className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded">
              <Clock size={13} /> Modification Pending
            </span>
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
        <div className="card p-0 overflow-hidden mb-4">
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

      {/* Modification Requests */}
      {modRequests.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <MessageSquare size={14} className="text-gray-500" />
            <h2 className="text-sm font-medium text-gray-700">Modification Requests</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {modRequests.map(req => {
              const st   = MOD_STATUS[req.status] ?? MOD_STATUS.pending;
              const Icon = st.icon;
              return (
                <div key={req.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{req.requester?.name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{format(new Date(req.created_at), 'd MMM yyyy HH:mm')}</p>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-medium border px-2.5 py-1 rounded-full ${st.color}`}>
                      <Icon size={12} /> {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Reason</p>
                    <p className="text-sm text-gray-700">{req.reason}</p>
                  </div>
                  {req.admin_notes && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-500 mb-1 font-medium uppercase tracking-wide">Admin Notes</p>
                      <p className="text-sm text-blue-800">{req.admin_notes}</p>
                      {req.reviewer && <p className="text-xs text-blue-400 mt-1">— {req.reviewer.name}</p>}
                    </div>
                  )}
                  {/* Admin review controls */}
                  {isAdmin && req.status === 'pending' && (
                    <div className="flex gap-2 flex-wrap items-center">
                      <input
                        type="text"
                        placeholder="Admin notes (optional)"
                        value={adminNotes[req.id] ?? ''}
                        onChange={e => setAdminNotes(n => ({ ...n, [req.id]: e.target.value }))}
                        className="flex-1 min-w-[180px] text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      <button
                        onClick={() => reviewModMutation.mutate({ reqId: req.id, status: 'approved', notes: adminNotes[req.id] ?? '' })}
                        disabled={reviewModMutation.isPending}
                        className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors">
                        Approve
                      </button>
                      <button
                        onClick={() => reviewModMutation.mutate({ reqId: req.id, status: 'rejected', notes: adminNotes[req.id] ?? '' })}
                        disabled={reviewModMutation.isPending}
                        className="text-xs px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors">
                        Reject
                      </button>
                      <button
                        onClick={() => reviewModMutation.mutate({ reqId: req.id, status: 'completed', notes: adminNotes[req.id] ?? '' })}
                        disabled={reviewModMutation.isPending}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        Mark Complete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Request Modification Modal */}
      {showModModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <MessageSquare size={18} className="text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-[#0A1628]">Request Modification</h2>
                <p className="text-xs text-[#6B82A8]">Bill {bill.bill_number}</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#0A1628] mb-1.5">
                Reason for modification <span className="text-red-500">*</span>
              </label>
              <textarea
                value={modReason}
                onChange={e => setModReason(e.target.value)}
                rows={4}
                placeholder="Describe what needs to be changed and why…"
                className="w-full border border-[#D4E2F4] rounded-lg px-3 py-2 text-sm text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#29ABE2] resize-none"
              />
              <p className="text-xs text-[#6B82A8] mt-1">{modReason.length}/1000 · minimum 5 characters</p>
            </div>
            {submitModMutation.isError && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                <AlertCircle size={13} />
                {submitModMutation.error?.response?.data?.message ?? 'Failed to submit request.'}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowModModal(false); setModReason(''); }}
                className="flex-1 py-2.5 border border-[#D4E2F4] text-[#6B82A8] rounded-xl text-sm hover:bg-[#F5F8FF] transition-colors">
                Cancel
              </button>
              <button
                onClick={() => submitModMutation.mutate()}
                disabled={modReason.trim().length < 5 || submitModMutation.isPending}
                className="flex-1 py-2.5 bg-[#1565C0] text-white rounded-xl text-sm font-medium hover:bg-[#1255A3] disabled:opacity-50 transition-colors">
                {submitModMutation.isPending ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
