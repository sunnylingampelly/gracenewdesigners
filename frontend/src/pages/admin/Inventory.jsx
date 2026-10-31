import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, categoriesApi } from '../../api/client';
import { AlertTriangle, Download, Settings } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

function getISTDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function exportCSV(filename, headers, rows) {
  const esc = v => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob(['﻿' + [headers, ...rows].map(r => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}

const MOVE_TYPES = ['add', 'remove', 'damaged', 'return', 'adjustment', 'sale', 'purchase'];
const MOVE_COLORS = { add: 'bg-green-100 text-green-700', remove: 'bg-red-100 text-red-600', damaged: 'bg-amber-100 text-amber-700', return: 'bg-blue-100 text-blue-700', sale: 'bg-purple-100 text-purple-700', purchase: 'bg-cyan-100 text-cyan-700', adjustment: 'bg-gray-100 text-gray-600' };

export default function Inventory() {
  const [tab, setTab] = useState('stock');
  const [filters, setFilters] = useState({ search: '', low_stock: false, category_id: '', page: 1 });
  const [movFilters, setMovFilters] = useState({ from: getISTDate().slice(0, 8) + '01', to: getISTDate(), type: '', page: 1 });
  const [adjustTarget, setAdjustTarget] = useState(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', filters],
    queryFn:  () => inventoryApi.list(filters).then(r => r.data),
    enabled:  tab === 'stock',
  });

  const { data: movements, isLoading: movLoading } = useQuery({
    queryKey: ['inventory-movements', movFilters],
    queryFn:  () => inventoryApi.movements({ ...movFilters, date_from: movFilters.from, date_to: movFilters.to, per_page: 50 }).then(r => r.data),
    enabled:  tab === 'movements',
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories-admin'],
    queryFn:  () => categoriesApi.adminList({ per_page: 100 }).then(r => r.data.data ?? r.data),
  });

  function doExport() {
    if (!data?.data) return;
    exportCSV(`stock-${getISTDate()}.csv`,
      ['SKU', 'Product', 'Category', 'Size', 'Color', 'On Hand', 'Reserved', 'Available', 'Damaged', 'Reorder At'],
      data.data.map(v => [v.sku, v.product?.name, v.product?.category?.name, v.size, v.color, v.qty_on_hand, v.qty_reserved, v.qty_on_hand - v.qty_reserved, v.qty_damaged, v.reorder_threshold])
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Inventory</h1>
        {tab === 'stock' && data?.data && (
          <button onClick={doExport} className="btn-secondary flex items-center gap-2 text-xs">
            <Download size={13} /> Export CSV
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[['stock', 'Stock on Hand'], ['movements', 'Stock Movements']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Stock on Hand ── */}
      {tab === 'stock' && (
        <>
          <div className="flex gap-3 flex-wrap items-center">
            <input className="input w-52 text-sm" placeholder="Search SKU or product…"
              value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value, page: 1 }))} />
            <select className="input w-44 text-sm" value={filters.category_id}
              onChange={e => setFilters(p => ({ ...p, category_id: e.target.value, page: 1 }))}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={filters.low_stock}
                onChange={e => setFilters(p => ({ ...p, low_stock: e.target.checked, page: 1 }))} />
              Low stock only
            </label>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[750px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left">
                    {['SKU', 'Product', 'Size / Color', 'On Hand', 'Reserved', 'Available', 'Damaged', 'Reorder', ''].map(h => (
                      <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase ${h && h !== 'SKU' && h !== 'Product' && h !== 'Size / Color' && h !== '' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
                  ) : data?.data?.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No inventory records found.</td></tr>
                  ) : data?.data?.map(v => {
                    const available = v.qty_on_hand - v.qty_reserved;
                    const isLow     = v.qty_on_hand <= v.reorder_threshold;
                    return (
                      <tr key={v.id} className={clsx('hover:bg-gray-50', isLow && 'bg-red-50/60')}>
                        <td className="px-4 py-3 font-mono text-xs">{v.sku}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{v.product?.name}</p>
                          <p className="text-xs text-gray-400">{v.product?.category?.name}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{[v.size, v.color].filter(Boolean).join(' / ') || '—'}</td>
                        <td className="px-4 py-3 text-right font-medium">{v.qty_on_hand}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{v.qty_reserved}</td>
                        <td className={clsx('px-4 py-3 text-right font-semibold', available <= 0 ? 'text-red-600' : 'text-green-700')}>{available}</td>
                        <td className="px-4 py-3 text-right text-amber-600">{v.qty_damaged}</td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          {isLow && <AlertTriangle size={13} className="inline text-red-500 mr-1" />}
                          {v.reorder_threshold}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setAdjustTarget(v)} title="Adjust stock"
                            className="text-gray-400 hover:text-blue-500 transition-colors">
                            <Settings size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Showing {data.from ?? 0}–{data.to ?? 0} of {data.total}</span>
                <div className="flex gap-2">
                  <button disabled={!data.prev_page_url} onClick={() => setFilters(p => ({...p, page: p.page-1}))}
                    className="btn-secondary py-1 px-2 text-xs disabled:opacity-40">Prev</button>
                  <button disabled={!data.next_page_url} onClick={() => setFilters(p => ({...p, page: p.page+1}))}
                    className="btn-secondary py-1 px-2 text-xs disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Stock Movements ── */}
      {tab === 'movements' && (
        <>
          <div className="flex gap-3 flex-wrap items-end">
            <div><label className="label">From</label>
              <input type="date" className="input w-40 text-sm" value={movFilters.from}
                onChange={e => setMovFilters(p => ({...p, from: e.target.value, page: 1}))} /></div>
            <div><label className="label">To</label>
              <input type="date" className="input w-40 text-sm" value={movFilters.to}
                onChange={e => setMovFilters(p => ({...p, to: e.target.value, page: 1}))} /></div>
            <div><label className="label">Type</label>
              <select className="input w-36 text-sm" value={movFilters.type}
                onChange={e => setMovFilters(p => ({...p, type: e.target.value, page: 1}))}>
                <option value="">All types</option>
                {MOVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[650px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left">
                    {['Date', 'SKU', 'Product', 'Type', 'Qty Change', 'Reference', 'User'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movLoading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
                  ) : movements?.data?.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No movements in this period.</td></tr>
                  ) : movements?.data?.map((m, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-500 text-xs">{m.created_at ? format(new Date(m.created_at), 'd MMM yy HH:mm') : '—'}</td>
                      <td className="px-4 py-2 font-mono text-xs">{m.variant?.sku}</td>
                      <td className="px-4 py-2">{m.variant?.product?.name}</td>
                      <td className="px-4 py-2"><span className={`badge text-xs ${MOVE_COLORS[m.movement_type] ?? 'bg-gray-100 text-gray-500'}`}>{m.movement_type}</span></td>
                      <td className={`px-4 py-2 font-mono font-semibold ${m.quantity_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {m.quantity_change > 0 ? '+' : ''}{m.quantity_change}
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{m.reference ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{m.user?.name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {movements && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Showing {movements.from ?? 0}–{movements.to ?? 0} of {movements.total}</span>
                <div className="flex gap-2">
                  <button disabled={!movements.prev_page_url} onClick={() => setMovFilters(p => ({...p, page: p.page-1}))}
                    className="btn-secondary py-1 px-2 text-xs disabled:opacity-40">Prev</button>
                  <button disabled={!movements.next_page_url} onClick={() => setMovFilters(p => ({...p, page: p.page+1}))}
                    className="btn-secondary py-1 px-2 text-xs disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {adjustTarget && (
        <StockAdjustModal
          variant={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onSaved={() => { setAdjustTarget(null); qc.invalidateQueries({ queryKey: ['inventory'] }); }}
        />
      )}
    </div>
  );
}

function StockAdjustModal({ variant, onClose, onSaved }) {
  const [type, setType]       = useState('add');
  const [quantity, setQty]    = useState(1);
  const [reason, setReason]   = useState('');
  const [error, setError]     = useState('');

  const mutation = useMutation({
    mutationFn: d => inventoryApi.adjust(d),
    onSuccess:  onSaved,
    onError:    err => setError(err.response?.data?.message || 'Adjustment failed.'),
  });

  function submit() {
    if (!reason.trim()) { setError('Reason is required.'); return; }
    if (quantity < 1)   { setError('Quantity must be at least 1.'); return; }
    mutation.mutate({ variant_id: variant.id, type, quantity: Number(quantity), reason });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="font-semibold text-lg">Adjust Stock</h2>
        <div>
          <p className="text-sm font-medium text-gray-800">{variant.product?.name}</p>
          <p className="text-xs text-gray-400 font-mono">{variant.sku} · On hand: {variant.qty_on_hand}</p>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>}

        <div>
          <label className="label">Adjustment Type</label>
          <div className="grid grid-cols-2 gap-2">
            {[['add','Add Stock'],['remove','Remove'],['damaged','Damaged'],['return','Return']].map(([k,l]) => (
              <label key={k} className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm transition-colors ${type===k ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}>
                <input type="radio" className="sr-only" checked={type===k} onChange={() => setType(k)} />
                {l}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Quantity *</label>
          <input type="number" className="input" min={1} value={quantity} onChange={e => setQty(e.target.value)} />
        </div>
        <div>
          <label className="label">Reason *</label>
          <input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Damaged in transit" />
        </div>

        <div className="flex gap-3">
          <button onClick={submit} disabled={mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending ? 'Saving…' : 'Apply Adjustment'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
