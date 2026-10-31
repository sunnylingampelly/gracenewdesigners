import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, usersApi } from '../../api/client';
import { format } from 'date-fns';
import { Download } from 'lucide-react';

const today    = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const monthStart = today.slice(0, 8) + '01';

function exportCSV(filename, headers, rows) {
  const esc = v => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
  a.download = filename; a.click();
}

const MODULES = ['product', 'purchase', 'inventory', 'sale', 'payment', 'crm', 'user', 'system', 'category', 'site'];
const ACTIONS  = ['create', 'update', 'delete', 'post', 'void', 'approve', 'reject', 'export', 'login', 'logout', 'activate', 'deactivate'];

const ACTION_COLORS = {
  create:     'bg-green-50 text-green-700',
  update:     'bg-blue-50 text-blue-700',
  delete:     'bg-red-50 text-red-700',
  void:       'bg-red-50 text-red-600',
  post:       'bg-indigo-50 text-indigo-700',
  login:      'bg-gray-50 text-gray-600',
  logout:     'bg-gray-50 text-gray-500',
  activate:   'bg-green-50 text-green-600',
  deactivate: 'bg-amber-50 text-amber-700',
  approve:    'bg-teal-50 text-teal-700',
  reject:     'bg-red-50 text-red-500',
  export:     'bg-purple-50 text-purple-700',
};

export default function AuditLog() {
  const [filters, setFilters] = useState({
    module: '', action: '', user_id: '',
    date_from: monthStart, date_to: today,
    page: 1,
  });

  const f = field => ({
    value: filters[field],
    onChange: e => setFilters(p => ({ ...p, [field]: e.target.value, page: 1 })),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', filters],
    queryFn:  () => reportsApi.auditLog(filters).then(r => r.data),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn:  () => usersApi.list().then(r => r.data.data ?? r.data),
  });

  function doExport() {
    if (!data?.data) return;
    exportCSV(`audit-${filters.date_from}-to-${filters.date_to}.csv`,
      ['Time', 'User', 'Role', 'Module', 'Action', 'Record', 'Reason'],
      data.data.map(e => [
        format(new Date(e.created_at), 'd MMM yy HH:mm'),
        e.user?.name ?? 'System',
        e.user?.role_label ?? '',
        e.module,
        e.action,
        `${e.record_type?.split('\\').pop() ?? ''} #${e.record_id ?? ''}`,
        e.reason ?? '',
      ])
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Audit Log</h1>
          <p className="text-xs text-gray-400 mt-0.5">All material actions are append-only and cannot be modified.</p>
        </div>
        <button onClick={doExport} className="btn-secondary flex items-center gap-2 text-xs">
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <label className="label">From</label>
          <input type="date" className="input w-36 text-sm" max={filters.date_to} {...f('date_from')} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input w-36 text-sm" min={filters.date_from} max={today} {...f('date_to')} />
        </div>
        <div>
          <label className="label">Module</label>
          <select className="input w-32 text-sm" {...f('module')}>
            <option value="">All</option>
            {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Action</label>
          <select className="input w-32 text-sm" {...f('action')}>
            <option value="">All</option>
            {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="label">User</label>
          <select className="input w-40 text-sm" {...f('user_id')}>
            <option value="">All users</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          {[['Today', today, today], ['This month', monthStart, today]].map(([l, fr, to]) => (
            <button key={l} onClick={() => setFilters(p => ({ ...p, date_from: fr, date_to: to, page: 1 }))}
              className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Module</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Record</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : data?.data?.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No audit events for this filter.</td></tr>
              ) : data?.data?.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 text-xs">
                  <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                    {format(new Date(e.created_at), 'd MMM yy HH:mm')}
                  </td>
                  <td className="px-4 py-2">
                    <p className="font-medium text-gray-800">{e.user?.name ?? 'System'}</p>
                    <p className="text-gray-400">{e.user?.role_label ?? ''}</p>
                  </td>
                  <td className="px-4 py-2 capitalize text-gray-600">{e.module}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${ACTION_COLORS[e.action] ?? 'bg-gray-100 text-gray-600'}`}>{e.action}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 font-mono">{e.record_type?.split('\\').pop()} #{e.record_id}</td>
                  <td className="px-4 py-2 text-gray-400 max-w-xs truncate">{e.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-4 py-3 border-t flex justify-between text-xs text-gray-500 flex-wrap gap-2">
            <span>Page {data.current_page} of {data.last_page} · {data.total} events</span>
            <div className="flex gap-2">
              <button disabled={!data.prev_page_url} onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))}
                className="btn-secondary py-1 px-2 text-xs disabled:opacity-40">Prev</button>
              <button disabled={!data.next_page_url} onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))}
                className="btn-secondary py-1 px-2 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
