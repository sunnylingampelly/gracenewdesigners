import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { salesApi, customersApi, productsApi } from '../../api/client';
import { Plus, Trash2, ChevronDown, User, Phone, CreditCard, Banknote, Smartphone, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';

const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const PAYMENT_MODES = [
  { key: 'cash',   label: 'Cash',   icon: Banknote },
  { key: 'card',   label: 'Card',   icon: CreditCard },
  { key: 'upi',    label: 'UPI',    icon: Smartphone },
  { key: 'cheque', label: 'Cheque', icon: CheckSquare },
];

const COUNTRY_CODES = [
  { code: '+91', label: '+91 IN' },
  { code: '+1',  label: '+1 US'  },
  { code: '+44', label: '+44 UK' },
  { code: '+971',label: '+971 UAE'},
  { code: '+65', label: '+65 SG' },
];

export default function NewSale() {
  const navigate = useNavigate();

  // ── Customer ──────────────────────────────────────────────
  const [customerMode, setCustomerMode] = useState('existing'); // existing | new
  const [customerId,   setCustomerId]   = useState('');
  const [custName,     setCustName]     = useState('');
  const [countryCode,  setCountryCode]  = useState('+91');
  const [custPhone,    setCustPhone]    = useState('');

  // ── Bill meta ─────────────────────────────────────────────
  const [billDate, setBillDate]         = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes,    setNotes]            = useState('');
  const [discount, setDiscount]         = useState(0);

  // ── Items ─────────────────────────────────────────────────
  const [items,         setItems]       = useState([]);
  const [selectedProd,  setSelectedProd]= useState('');
  const [selectedVar,   setSelectedVar] = useState('');

  // ── Payment ───────────────────────────────────────────────
  const [payMode,    setPayMode]        = useState('cash');
  const [paidAmount, setPaidAmount]     = useState('');

  const [error, setError] = useState('');

  // ── Data queries ──────────────────────────────────────────
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-list'],
    queryFn:  () => customersApi.list({ per_page: 200 }).then(r => r.data.data ?? r.data),
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ['products-for-sale'],
    queryFn:  () => productsApi.list({ status: 'published', per_page: 200 }).then(r => r.data.data ?? r.data),
  });

  const selectedProduct = useMemo(
    () => allProducts.find(p => String(p.id) === String(selectedProd)),
    [allProducts, selectedProd]
  );

  const availableVariants = useMemo(
    () => (selectedProduct?.variants ?? []).filter(v => (v.qty_on_hand - v.qty_reserved) > 0),
    [selectedProduct]
  );

  // ── Derived totals ────────────────────────────────────────
  function calcLine(it) {
    const base = it.quantity * it.unit_price;
    const disc = base * (it.discount_percent / 100);
    return base - disc;
  }

  const subtotal = items.reduce((s, it) => s + calcLine(it), 0);
  const total    = Math.max(0, subtotal - Number(discount));
  const balance  = total - Number(paidAmount || 0);

  // ── Item helpers ──────────────────────────────────────────
  function addItem() {
    const variant = availableVariants.find(v => String(v.id) === String(selectedVar));
    if (!variant || !selectedProduct) return;
    if (items.find(i => i.variant_id === variant.id)) {
      setError('This variant is already in the bill.');
      return;
    }
    setItems(prev => [...prev, {
      variant_id:       variant.id,
      sku:              variant.sku,
      product_name:     selectedProduct.name,
      size:             variant.size,
      color:            variant.color,
      quantity:         1,
      unit_price:       variant.selling_price ?? 0,
      discount_percent: 0,
      available_qty:    variant.qty_on_hand - variant.qty_reserved,
    }]);
    setSelectedProd('');
    setSelectedVar('');
    setError('');
  }

  function updateItem(idx, field, val) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Submit ────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: data => salesApi.create(data),
    onSuccess:  () => navigate('/admin/sales'),
    onError:    err => setError(err.response?.data?.message || 'Failed to create bill.'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Validate customer
    if (customerMode === 'existing' && !customerId) {
      setError('Please select a customer.'); return;
    }
    if (customerMode === 'new') {
      if (!custName.trim()) { setError('Customer name is required.'); return; }
      if (!custPhone.trim()) { setError('Mobile number is required.'); return; }
      if (!/^\d{7,15}$/.test(custPhone.trim())) { setError('Enter a valid mobile number.'); return; }
    }
    if (items.length === 0) { setError('Add at least one product.'); return; }

    const payload = {
      customer_id:     customerMode === 'existing' ? customerId : null,
      walk_in_name:    customerMode === 'new' ? custName.trim() : null,
      walk_in_phone:   customerMode === 'new' ? `${countryCode}${custPhone.trim()}` : null,
      is_walk_in:      customerMode === 'new',
      bill_date:       billDate,
      discount_amount: Number(discount),
      notes,
      payment_mode:    payMode,
      amount_paid:     Number(paidAmount || 0),
      items: items.map(it => ({
        variant_id:       it.variant_id,
        quantity:         Number(it.quantity),
        unit_price:       Number(it.unit_price),
        discount_percent: Number(it.discount_percent),
        tax_rate:         0,
      })),
    };

    createMutation.mutate(payload);
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl pb-32">
      <h1 className="text-xl font-semibold mb-6">New Sales Bill</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Customer ── */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-sm text-gray-700 flex items-center gap-2"><User size={15} /> Customer</h2>
            <div className="flex gap-1 text-xs bg-gray-100 p-0.5 rounded">
              {[['existing','Existing'],['new','New / Walk-in']].map(([k,l]) => (
                <button key={k} type="button" onClick={() => setCustomerMode(k)}
                  className={`px-3 py-1 rounded transition-colors ${customerMode===k ? 'bg-white shadow text-gray-800 font-medium' : 'text-gray-500'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {customerMode === 'existing' ? (
            <div>
              <label className="label">Select Customer *</label>
              <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)} required>
                <option value="">— Choose customer —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name *</label>
                <input className="input" value={custName} onChange={e => setCustName(e.target.value)}
                  placeholder="Customer name" required />
              </div>
              <div>
                <label className="label">Mobile Number *</label>
                <div className="flex gap-2">
                  <select className="input w-28 shrink-0" value={countryCode} onChange={e => setCountryCode(e.target.value)}>
                    {COUNTRY_CODES.map(cc => (
                      <option key={cc.code} value={cc.code}>{cc.label}</option>
                    ))}
                  </select>
                  <input className="input flex-1" value={custPhone}
                    onChange={e => setCustPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="81818 16202" maxLength={15} inputMode="tel" required />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="label">Bill Date</label>
            <input type="date" className="input w-40" value={billDate} onChange={e => setBillDate(e.target.value)} required />
          </div>
        </div>

        {/* ── Products ── */}
        <div className="card space-y-4">
          <h2 className="font-medium text-sm text-gray-700 flex items-center gap-2"><Plus size={15} /> Add Products</h2>

          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="label">Product</label>
              <div className="relative">
                <select className="input appearance-none pr-8"
                  value={selectedProd}
                  onChange={e => { setSelectedProd(e.target.value); setSelectedVar(''); }}>
                  <option value="">— Select product —</option>
                  {allProducts.map(p => (
                    <option key={p.id} value={p.id} disabled={!p.variants?.some(v => v.qty_on_hand - v.qty_reserved > 0)}>
                      {p.name} {!p.variants?.some(v => v.qty_on_hand - v.qty_reserved > 0) ? '(out of stock)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {selectedProduct && (
              <div className="min-w-[180px]">
                <label className="label">Variant / Size</label>
                <div className="relative">
                  <select className="input appearance-none pr-8"
                    value={selectedVar}
                    onChange={e => setSelectedVar(e.target.value)}>
                    <option value="">— Select variant —</option>
                    {availableVariants.map(v => (
                      <option key={v.id} value={v.id}>
                        {[v.size, v.color].filter(Boolean).join(' / ')} · Avail: {v.qty_on_hand - v.qty_reserved}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}

            <button type="button" onClick={addItem}
              disabled={!selectedVar}
              className="btn-primary flex items-center gap-2 shrink-0 disabled:opacity-40">
              <Plus size={14} /> Add
            </button>
          </div>

          {/* Items table */}
          {items.length > 0 && (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="pb-2 text-xs text-gray-500 font-medium">Product</th>
                    <th className="pb-2 text-xs text-gray-500 font-medium text-center w-20">Qty</th>
                    <th className="pb-2 text-xs text-gray-500 font-medium text-right w-28">Price (₹)</th>
                    <th className="pb-2 text-xs text-gray-500 font-medium text-center w-20">Disc %</th>
                    <th className="pb-2 text-xs text-gray-500 font-medium text-right w-24">Total</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((it, idx) => (
                    <tr key={it.variant_id}>
                      <td className="py-2.5">
                        <p className="font-medium text-gray-900">{it.product_name}</p>
                        <p className="text-xs text-gray-400">{it.sku}{it.size ? ` · ${it.size}` : ''}{it.color ? ` · ${it.color}` : ''}</p>
                        <p className="text-xs text-gray-300">Available: {it.available_qty}</p>
                      </td>
                      <td className="py-2.5 text-center">
                        <input type="number" min={1} max={it.available_qty}
                          className="input w-16 text-center py-1.5 text-sm"
                          value={it.quantity}
                          onChange={e => updateItem(idx, 'quantity', Math.min(Number(e.target.value), it.available_qty))} />
                      </td>
                      <td className="py-2.5">
                        <input type="number" min={0} step="0.01"
                          className="input w-full text-right py-1.5 text-sm"
                          value={it.unit_price}
                          onChange={e => updateItem(idx, 'unit_price', e.target.value)} />
                      </td>
                      <td className="py-2.5 text-center">
                        <input type="number" min={0} max={100}
                          className="input w-16 text-center py-1.5 text-sm"
                          value={it.discount_percent}
                          onChange={e => updateItem(idx, 'discount_percent', e.target.value)} />
                      </td>
                      <td className="py-2.5 text-right font-medium">{fmt(calcLine(it))}</td>
                      <td className="py-2.5 pl-2">
                        <button type="button" onClick={() => removeItem(idx)}
                          className="text-red-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {items.length === 0 && (
            <p className="text-center text-gray-300 text-sm py-6 border border-dashed border-gray-200 rounded">
              No products added yet
            </p>
          )}
        </div>

        {/* ── Totals + Discount ── */}
        <div className="card grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div>
              <label className="label">Bill Discount (₹)</label>
              <input type="number" min={0} max={subtotal} className="input"
                value={discount} onChange={e => setDiscount(e.target.value)} />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Any special instructions…" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span><span>{fmt(subtotal)}</span>
            </div>
            {Number(discount) > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Discount</span><span className="text-red-500">− {fmt(discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base border-t border-gray-200 pt-2 mt-1">
              <span>Total</span><span>{fmt(total)}</span>
            </div>
            {Number(paidAmount) > 0 && (
              <>
                <div className="flex justify-between text-green-600">
                  <span>Paid</span><span>{fmt(paidAmount)}</span>
                </div>
                <div className={`flex justify-between font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  <span>{balance > 0 ? 'Balance Due' : 'Change'}</span>
                  <span>{fmt(Math.abs(balance))}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Payment Mode ── */}
        <div className="card space-y-4">
          <h2 className="font-medium text-sm text-gray-700">Payment</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {PAYMENT_MODES.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button"
                onClick={() => setPayMode(key)}
                className={`flex items-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium transition-all ${
                  payMode === key
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>

          <div className="max-w-xs">
            <label className="label">Amount Received (₹)</label>
            <input type="number" min={0} className="input text-lg font-semibold"
              placeholder={fmt(total)}
              value={paidAmount}
              onChange={e => setPaidAmount(e.target.value)} />
            {total > 0 && (
              <button type="button" onClick={() => setPaidAmount(total)}
                className="text-xs text-blue-600 mt-1 hover:underline">
                Set exact amount ({fmt(total)})
              </button>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 flex-wrap sticky bottom-0 bg-white border-t border-gray-100 -mx-6 px-6 py-4 md:static md:border-0 md:bg-transparent md:p-0">
          <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1 md:flex-none">
            {createMutation.isPending ? 'Saving…' : '✓ Save Bill'}
          </button>
          <button type="button" onClick={() => navigate('/admin/sales')} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
