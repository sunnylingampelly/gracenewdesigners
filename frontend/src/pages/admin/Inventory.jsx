import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '../../api/client';
import { AlertTriangle, Package } from 'lucide-react';
import clsx from 'clsx';

export default function Inventory() {
  const [filters, setFilters] = useState({ search: '', low_stock: false, page: 1 });

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', filters],
    queryFn:  () => inventoryApi.list(filters).then(r => r.data),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Inventory</h1>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <input
          className="input w-52 text-sm"
          placeholder="Search SKU or product…"
          value={filters.search}
          onChange={e => setFilters(p => ({ ...p, search: e.target.value, page: 1 }))}
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={filters.low_stock}
            onChange={e => setFilters(p => ({ ...p, low_stock: e.target.checked, page: 1 }))} />
          Low stock only
        </label>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left">
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Size / Color</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">On Hand</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Reserved</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Available</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Damaged</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Reorder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : data?.data?.map(v => {
              const available = v.qty_on_hand - v.qty_reserved;
              const isLow     = v.qty_on_hand <= v.reorder_threshold;
              return (
                <tr key={v.id} className={clsx('hover:bg-gray-50', isLow && 'bg-red-50')}>
                  <td className="px-4 py-3 font-mono text-xs">{v.sku}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{v.product?.name}</p>
                    <p className="text-xs text-gray-400">{v.product?.category?.name}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{v.size} {v.color}</td>
                  <td className="px-4 py-3 text-right font-medium">{v.qty_on_hand}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{v.qty_reserved}</td>
                  <td className={clsx('px-4 py-3 text-right font-semibold', available <= 0 ? 'text-red-600' : 'text-green-700')}>
                    {available}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-600">{v.qty_damaged}</td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {isLow && <AlertTriangle size={13} className="inline text-red-500 mr-1" />}
                    {v.reorder_threshold}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {data && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Showing {data.from ?? 0}–{data.to ?? 0} of {data.total}</span>
            <div className="flex gap-2">
              <button disabled={!data.prev_page_url} onClick={() => setFilters(p => ({...p, page: p.page-1}))}
                className="btn btn-secondary py-1 px-2 text-xs disabled:opacity-40">Prev</button>
              <button disabled={!data.next_page_url} onClick={() => setFilters(p => ({...p, page: p.page+1}))}
                className="btn btn-secondary py-1 px-2 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
