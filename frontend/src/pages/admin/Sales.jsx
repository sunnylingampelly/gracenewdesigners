import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { salesApi, usersApi } from '../../api/client';
import { Plus, Search, Eye, Download } from 'lucide-react';
import { StatusBadge } from './Dashboard';
import { format } from 'date-fns';

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

function getIST() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); }
function firstOfMonth() { return getIST().slice(0, 8) + '01'; }

function exportCSV(filename, headers, rows) {
  const esc = v => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
  a.download = filename; a.click();
}

const STATUSES = ['draft', 'posted', 'paid', 'partial', 'void', 'refunded'];
const MODES    = ['cash', 'card', 'upi', 'cheque'];

const PRESETS = [
  { label: 'Today',      from: () => getIST(),        to: () => getIST() },
  { label: 'This Week',  from: () => { const d = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Kolkata'})); d.setDate(d.getDate()-d.getDay()); return d.toLocaleDateString('en-CA'); }, to: () => getIST() },
  { label: 'This Month', from: firstOfMonth,           to: () => getIST() },
];

export default function Sales() {
  const today = getIST();
  const [search,      setSearch]      = useState('');
  const [status,      setStatus]      = useState('');
  const [payMode,     setPayMode]     = useState('');
  const [staffId,     setStaffId]     = useState('');
  const [fromDate,    setFromDate]    = useState(firstOfMonth());
  const [toDate,      setToDate]      = useState(today);
  const [page,        setPage]        = useState(1);

  const filters = { search, status, payment_mode: payMode, created_by: staffId, date_from: fromDate, date_to: toDate, page };

  const { data, isLoading } = useQuery({
    queryKey: ['sales', filters],
    queryFn:  () => salesApi.list(filters).then(r => r.data),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn:  () => usersApi.list().then(r => r.data.data ?? r.data),
  });

  function applyPreset(p) {
    setFromDate(p.from()); setToDate(p.to()); setPage(1);
  }

  function handleExport() {
    const rows = (data?.data ?? []).map(b => [
      b.bill_number,
      b.bill_date,
      b.customer?.name ?? b.walk_in_name ?? 'Walk-in',
      b.creator?.name ?? '',
      b.total_amount,
      b.amount_paid,
      b.amount_due,
      b.status,
      b.payments?.[0]?.mode ?? '',
    ]);
    exportCSV(`sales-${fromDate}-to-${toDate}.csv`,
      ['Bill #','Date','Customer','Staff','Total','Paid','Due','Status','Payment Mode'],
      rows
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Sales Bills</h1>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-xs">
            <Download size={13} /> Export CSV
          </button>
          <Link to="/admin/sales/new" className="btn-primary flex items-center gap-2">
            <Plus size={15} /> New Bill
          </Link>
        </div>
      </div>

      {/* Quick presets */}
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => applyPreset(p)}
            className={`text-xs px-3 py-1.5 border rounded-full transition-colors ${
              fromDate === p.from() && toDate === p.to()
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-600'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-end">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8 w-44 text-sm" placeholder="Bill number…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input w-36 text-sm" value={fromDate} max={toDate}
            onChange={e => { setFromDate(e.target.value); setPage(1); }} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input w-36 text-sm" value={toDate} min={fromDate} max={today}
            onChange={e => { setToDate(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-32 text-sm" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input w-28 text-sm" value={payMode} onChange={e => { setPayMode(e.target.value); setPage(1); }}>
          <option value="">All modes</option>
          {MODES.map(m => <option key={m} value={m} className="capitalize">{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
        </select>
        <select className="input w-36 text-sm" value={staffId} onChange={e => { setStaffId(e.target.value); setPage(1); }}>
          <option value="">All staff</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left">
                {['Bill #','Date','Customer','Staff','Payment','Total','Due','Status',''].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase ${h === 'Total' || h === 'Due' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : !data?.data?.length ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No bills found.</td></tr>
              ) : data.data.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{b.bill_number}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{format(new Date(b.bill_date), 'd MMM yy')}</td>
                  <td className="px-4 py-3">{b.customer?.name ?? b.walk_in_name ?? 'Walk-in'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{b.creator?.name}</td>
                  <td className="px-4 py-3 text-xs capitalize text-gray-500">{b.payments?.[0]?.mode ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(b.total_amount)}</td>
                  <td className="px-4 py-3 text-right text-amber-700">{b.amount_due > 0 ? fmt(b.amount_due) : '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/sales/${b.id}`} className="text-blue-500 hover:text-blue-700">
                      <Eye size={15} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>{data.total ? `Showing ${data.from ?? 0}–${data.to ?? 0} of ${data.total}` : 'No results'}</span>
            <div className="flex gap-2">
              <button disabled={!data.prev_page_url} onClick={() => setPage(p => p - 1)}
                className="btn-secondary py-1 px-2 text-xs disabled:opacity-40">Prev</button>
              <button disabled={!data.next_page_url} onClick={() => setPage(p => p + 1)}
                className="btn-secondary py-1 px-2 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
