import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchasesApi, suppliersApi, productsApi } from '../../api/client';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
function getISTDate() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); }
const STATUS = { draft:'bg-gray-100 text-gray-500', ordered:'bg-blue-100 text-blue-600', received:'bg-green-100 text-green-700', partial:'bg-amber-100 text-amber-700', cancelled:'bg-red-50 text-red-500' };

export default function Purchases() {
  const [filters, setFilters] = useState({ page: 1, supplier_id: '', status: '', date_from: '', date_to: '' });
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => suppliersApi.list({ per_page: 100 }).then(r => r.data.data ?? r.data),
  });

  const { data } = useQuery({
    queryKey: ['purchases', filters],
    queryFn: () => purchasesApi.list(filters).then(r => r.data),
  });

  const sf = (k, v) => setFilters(p => ({ ...p, [k]: v, page: 1 }));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Purchases</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> New Purchase
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">From</label>
          <input type="date" className="input w-36 text-sm" value={filters.date_from} onChange={e => sf('date_from', e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input w-36 text-sm" value={filters.date_to} onChange={e => sf('date_to', e.target.value)} />
        </div>
        <div>
          <label className="label">Supplier</label>
          <select className="input text-sm" value={filters.supplier_id} onChange={e => sf('supplier_id', e.target.value)}>
            <option value="">All suppliers</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input text-sm" value={filters.status} onChange={e => sf('status', e.target.value)}>
            <option value="">All statuses</option>
            {Object.keys(STATUS).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left">
                {['Ref #','Supplier','Order Date','Items','Total','Status','Payment'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.data?.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{p.reference_number}</td>
                  <td className="px-4 py-3">{p.supplier?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{format(new Date(p.order_date), 'd MMM yy')}</td>
                  <td className="px-4 py-3 text-center">{p.items?.length ?? '—'}</td>
                  <td className="px-4 py-3 font-medium">{fmt(p.total_amount)}</td>
                  <td className="px-4 py-3"><span className={`badge ${STATUS[p.status] ?? 'bg-gray-100 text-gray-500'}`}>{p.status}</span></td>
                  <td className="px-4 py-3"><span className={`badge ${p.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{p.payment_status}</span></td>
                </tr>
              ))}
              {(!data?.data?.length) && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">No purchases found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Showing {data.from ?? 0}–{data.to ?? 0} of {data.total ?? 0}</span>
            <div className="flex gap-2">
              <button disabled={!data.prev_page_url} onClick={() => setFilters(p => ({...p, page: p.page-1}))}
                className="btn-secondary py-1 px-2 text-xs disabled:opacity-40">Prev</button>
              <button disabled={!data.next_page_url} onClick={() => setFilters(p => ({...p, page: p.page+1}))}
                className="btn-secondary py-1 px-2 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <NewPurchaseModal
          suppliers={suppliers}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['purchases'] }); }}
        />
      )}
    </div>
  );
}

function NewPurchaseModal({ suppliers, onClose, onSaved }) {
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate]   = useState(getISTDate());
  const [notes, setNotes]           = useState('');
  const [items, setItems]           = useState([]);
  const [selProd, setSelProd]       = useState('');
  const [selVar, setSelVar]         = useState('');
  const [error, setError]           = useState('');

  const { data: products = [] } = useQuery({
    queryKey: ['products-for-purchase'],
    queryFn: () => productsApi.list({ status: 'published', per_page: 200 }).then(r => r.data.data ?? r.data),
  });

  const selectedProduct = useMemo(() => products.find(p => String(p.id) === String(selProd)), [products, selProd]);
  const variants = selectedProduct?.variants ?? [];

  const subtotal  = items.reduce((s, it) => s + it.quantity * it.cost_price, 0);
  const taxTotal  = items.reduce((s, it) => s + (it.quantity * it.cost_price * (it.tax_rate / 100)), 0);
  const grandTotal = subtotal + taxTotal;

  function addItem() {
    const variant = variants.find(v => String(v.id) === String(selVar));
    if (!variant || !selectedProduct) return;
    if (items.find(i => i.variant_id === variant.id)) { setError('Variant already added.'); return; }
    setItems(prev => [...prev, {
      variant_id: variant.id,
      product_name: selectedProduct.name,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      quantity: 1,
      cost_price: variant.cost_price ?? 0,
      tax_rate: 0,
      discount_percent: 0,
    }]);
    setSelProd(''); setSelVar(''); setError('');
  }

  function updateItem(idx, field, val) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }

  const mutation = useMutation({
    mutationFn: () => purchasesApi.create({
      supplier_id: supplierId,
      order_date: orderDate,
      notes,
      items: items.map(it => ({
        variant_id: it.variant_id,
        quantity: Number(it.quantity),
        cost_price: Number(it.cost_price),
        tax_rate: Number(it.tax_rate),
        discount_percent: Number(it.discount_percent),
      })),
    }),
    onSuccess: onSaved,
    onError: err => setError(err.response?.data?.message || 'Failed to create purchase.'),
  });

  function submit() {
    if (!supplierId) { setError('Please select a supplier.'); return; }
    if (items.length === 0) { setError('Add at least one product.'); return; }
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl space-y-5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">New Purchase Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="label">Supplier *</label>
            <select className="input" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
              <option value="">— Select supplier —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Order Date</label>
            <input type="date" className="input" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes…" />
          </div>
        </div>

        {/* Add product row */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Add Items</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="label">Product</label>
              <select className="input appearance-none" value={selProd} onChange={e => { setSelProd(e.target.value); setSelVar(''); }}>
                <option value="">— Select —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {selectedProduct && (
              <div className="min-w-[160px]">
                <label className="label">Variant</label>
                <select className="input" value={selVar} onChange={e => setSelVar(e.target.value)}>
                  <option value="">— Select —</option>
                  {variants.map(v => <option key={v.id} value={v.id}>{[v.size, v.color].filter(Boolean).join(' / ') || v.sku}</option>)}
                </select>
              </div>
            )}
            <button type="button" onClick={addItem} disabled={!selVar} className="btn-primary disabled:opacity-40">
              <Plus size={14} /> Add
            </button>
          </div>

          {items.length > 0 && (
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="pb-2 text-xs text-gray-500 font-medium">Product</th>
                    <th className="pb-2 text-xs text-gray-500 font-medium text-center w-16">Qty</th>
                    <th className="pb-2 text-xs text-gray-500 font-medium text-right w-28">Cost (₹)</th>
                    <th className="pb-2 text-xs text-gray-500 font-medium text-center w-16">Tax %</th>
                    <th className="pb-2 text-xs text-gray-500 font-medium text-right w-24">Total</th>
                    <th className="w-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((it, idx) => (
                    <tr key={it.variant_id}>
                      <td className="py-2">
                        <p className="font-medium">{it.product_name}</p>
                        <p className="text-xs text-gray-400">{it.sku}{it.size ? ` · ${it.size}` : ''}{it.color ? ` · ${it.color}` : ''}</p>
                      </td>
                      <td className="py-2"><input type="number" min={1} className="input w-14 text-center py-1 text-sm" value={it.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} /></td>
                      <td className="py-2"><input type="number" min={0} step="0.01" className="input text-right py-1 text-sm" value={it.cost_price} onChange={e => updateItem(idx, 'cost_price', e.target.value)} /></td>
                      <td className="py-2"><input type="number" min={0} max={100} className="input w-14 text-center py-1 text-sm" value={it.tax_rate} onChange={e => updateItem(idx, 'tax_rate', e.target.value)} /></td>
                      <td className="py-2 text-right font-medium">{fmt(it.quantity * it.cost_price)}</td>
                      <td className="py-2 pl-2"><button onClick={() => setItems(p => p.filter((_, i) => i !== idx))} className="text-red-300 hover:text-red-500"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {items.length === 0 && <p className="text-center text-gray-300 text-sm py-5 border border-dashed border-gray-200 rounded mt-3">No items added</p>}
        </div>

        {/* Totals */}
        {items.length > 0 && (
          <div className="flex justify-end">
            <div className="bg-gray-50 rounded-lg p-4 space-y-1 text-sm min-w-[220px]">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Tax</span><span>{fmt(taxTotal)}</span></div>
              <div className="flex justify-between font-semibold text-base border-t border-gray-200 pt-2 mt-1"><span>Grand Total</span><span>{fmt(grandTotal)}</span></div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button onClick={submit} disabled={mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending ? 'Saving…' : 'Save as Draft'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
