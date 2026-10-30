import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { salesApi } from '../../api/client';
import { Plus, Search, Eye } from 'lucide-react';
import { StatusBadge } from './Dashboard';
import { format } from 'date-fns';

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

export default function Sales() {
  const [filters, setFilters] = useState({ search: '', status: '', page: 1 });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['sales', filters],
    queryFn:  () => salesApi.list(filters).then(r => r.data),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sales Bills</h1>
        <Link to="/admin/sales/new" className="btn-primary">
          <Plus size={16} /> New Bill
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-8 w-48 text-sm"
            placeholder="Bill number…"
            value={filters.search}
            onChange={e => setFilters(p => ({ ...p, search: e.target.value, page: 1 }))}
          />
        </div>
        <select
          className="input w-36 text-sm"
          value={filters.status}
          onChange={e => setFilters(p => ({ ...p, status: e.target.value, page: 1 }))}
        >
          <option value="">All statuses</option>
          {['draft','posted','paid','partial','void','refunded'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left">
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Bill #</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Staff</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Total</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Due</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : data?.data?.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No bills found.</td></tr>
            ) : data?.data?.map(b => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-medium">{b.bill_number}</td>
                <td className="px-4 py-3 text-gray-500">{format(new Date(b.bill_date), 'd MMM yy')}</td>
                <td className="px-4 py-3">{b.customer?.name ?? b.walk_in_name ?? 'Walk-in'}</td>
                <td className="px-4 py-3 text-gray-500">{b.creator?.name}</td>
                <td className="px-4 py-3 text-right font-medium">{fmt(b.total_amount)}</td>
                <td className="px-4 py-3 text-right text-amber-700">{b.amount_due > 0 ? fmt(b.amount_due) : '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                <td className="px-4 py-3">
                  <Link to={`/admin/sales/${b.id}`} className="text-brand-500 hover:text-brand-600">
                    <Eye size={15} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Showing {data.from}–{data.to} of {data.total}</span>
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
