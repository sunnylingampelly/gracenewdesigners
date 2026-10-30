import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { salesApi, customersApi, productsApi } from '../../api/client';
import { Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

export default function NewSale() {
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState('');
  const [walkIn, setWalkIn]         = useState('');
  const [billDate, setBillDate]     = useState(format(new Date(), 'yyyy-MM-dd'));
  const [discount, setDiscount]     = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [notes, setNotes]           = useState('');
  const [items, setItems]           = useState([]);
  const [error, setError]           = useState('');
  const [productSearch, setProductSearch] = useState('');

  const { data: customers } = useQuery({
    queryKey: ['customers-search'],
    queryFn:  () => customersApi.list({ per_page: 100 }).then(r => r.data.data),
  });

  const { data: products } = useQuery({
    queryKey: ['products-for-sale', productSearch],
    queryFn:  () => productsApi.list({ search: productSearch, status: 'published', per_page: 50 }).then(r => r.data.data),
    enabled:  productSearch.length > 1,
  });

  const createMutation = useMutation({
    mutationFn: data => salesApi.create(data),
    onSuccess:  ({ data }) => navigate('/admin/sales'),
    onError:    err => setError(err.response?.data?.message || 'Failed to create bill.'),
  });

  function addVariant(variant, product) {
    if (items.find(i => i.variant_id === variant.id)) return;
    setItems(prev => [...prev, {
      variant_id:       variant.id,
      sku:              variant.sku,
      product_name:     product.name,
      size:             variant.size,
      color:            variant.color,
      quantity:         1,
      unit_price:       variant.selling_price || 0,
      discount_percent: 0,
      tax_rate:         0,
      available_qty:    variant.qty_on_hand - variant.qty_reserved,
    }]);
    setProductSearch('');
  }

  function updateItem(idx, field, val) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function calcLine(item) {
    const base = item.quantity * item.unit_price;
    const disc = base * (item.discount_percent / 100);
    const tax  = (base - disc) * (item.tax_rate / 100);
    return base - disc + tax;
  }

  const subtotal = items.reduce((s, it) => s + calcLine(it), 0);
  const total    = subtotal - Number(discount);

  function handleSubmit(e) {
    e.preventDefault();
    if (items.length === 0) { setError('Add at least one item.'); return; }
    createMutation.mutate({
      customer_id:     customerId || null,
      walk_in_name:    walkIn || null,
      is_walk_in:      !customerId,
      bill_date:       billDate,
      discount_amount: Number(discount),
      discount_reason: discountReason,
      notes,
      items: items.map(it => ({
        variant_id:       it.variant_id,
        quantity:         Number(it.quantity),
        unit_price:       Number(it.unit_price),
        discount_percent: Number(it.discount_percent),
        tax_rate:         Number(it.tax_rate),
      })),
    });
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-semibold mb-6">New Sales Bill</h1>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="card grid grid-cols-2 gap-4">
          <div>
            <label className="label">Customer</label>
            <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">— Walk-in customer —</option>
              {customers?.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
            </select>
          </div>
          {!customerId && (
            <div>
              <label className="label">Walk-in Name</label>
              <input className="input" value={walkIn} onChange={e => setWalkIn(e.target.value)} placeholder="Optional" />
            </div>
          )}
          <div>
            <label className="label">Bill Date</label>
            <input type="date" className="input" value={billDate} onChange={e => setBillDate(e.target.value)} required />
          </div>
        </div>

        {/* Product search */}
        <div className="card">
          <label className="label">Add Product</label>
          <input
            className="input mb-3"
            placeholder="Search product name…"
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
          />
          {products && productSearch.length > 1 && (
            <div className="border border-gray-200 rounded divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {products.flatMap(p => p.variants?.map(v => (
                <button type="button" key={v.id}
                  onClick={() => addVariant(v, p)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex justify-between">
                  <span>{p.name} — {v.size} {v.color} <span className="text-gray-400 text-xs">{v.sku}</span></span>
                  <span className="text-gray-500 text-xs">Avail: {v.qty_on_hand - v.qty_reserved}</span>
                </button>
              )))}
            </div>
          )}

          {items.length > 0 && (
            <table className="w-full text-sm mt-4">
              <thead className="text-left border-b border-gray-100">
                <tr>
                  <th className="pb-2 text-xs text-gray-500">Item</th>
                  <th className="pb-2 text-xs text-gray-500 text-center">Qty</th>
                  <th className="pb-2 text-xs text-gray-500 text-right">Price</th>
                  <th className="pb-2 text-xs text-gray-500 text-center">Disc%</th>
                  <th className="pb-2 text-xs text-gray-500 text-center">Tax%</th>
                  <th className="pb-2 text-xs text-gray-500 text-right">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((it, idx) => (
                  <tr key={it.variant_id}>
                    <td className="py-2">
                      <p className="font-medium">{it.product_name}</p>
                      <p className="text-xs text-gray-400">{it.sku} · {it.size} {it.color}</p>
                    </td>
                    <td className="py-2 text-center">
                      <input type="number" min={1} max={it.available_qty}
                        className="input w-16 text-center py-1 text-sm"
                        value={it.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                    </td>
                    <td className="py-2 text-right">
                      <input type="number" min={0}
                        className="input w-24 text-right py-1 text-sm"
                        value={it.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} />
                    </td>
                    <td className="py-2 text-center">
                      <input type="number" min={0} max={100}
                        className="input w-16 text-center py-1 text-sm"
                        value={it.discount_percent} onChange={e => updateItem(idx, 'discount_percent', e.target.value)} />
                    </td>
                    <td className="py-2 text-center">
                      <input type="number" min={0}
                        className="input w-16 text-center py-1 text-sm"
                        value={it.tax_rate} onChange={e => updateItem(idx, 'tax_rate', e.target.value)} />
                    </td>
                    <td className="py-2 text-right font-medium">{fmt(calcLine(it))}</td>
                    <td className="py-2 pl-2">
                      <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Totals */}
        <div className="card grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="label">Bill Discount (₹)</label>
              <input type="number" min={0} className="input" value={discount} onChange={e => setDiscount(e.target.value)} />
            </div>
            <div>
              <label className="label">Discount Reason</label>
              <input className="input" value={discountReason} onChange={e => setDiscountReason(e.target.value)} />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col justify-end gap-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Discount</span><span>-{fmt(discount)}</span></div>
            <div className="flex justify-between font-semibold text-base border-t border-gray-200 pt-2 mt-2">
              <span>Total</span><span>{fmt(total)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={createMutation.isPending} className="btn-primary">
            {createMutation.isPending ? 'Saving…' : 'Save Draft Bill'}
          </button>
          <button type="button" onClick={() => navigate('/admin/sales')} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}
