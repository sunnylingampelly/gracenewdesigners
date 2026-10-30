import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api/client';
import { format } from 'date-fns';

export default function AuditLog() {
  const [filters, setFilters] = useState({ module: '', action: '', page: 1 });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', filters],
    queryFn:  () => reportsApi.auditLog(filters).then(r => r.data),
  });

  const F = f => ({ value: filters[f], onChange: e => setFilters(p => ({...p, [f]: e.target.value, page: 1})) });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Audit Log</h1>
      <p className="text-sm text-gray-500">All material actions are recorded and cannot be modified.</p>

      <div className="flex gap-3 flex-wrap">
        <select className="input w-36 text-sm" {...F('module')}>
          <option value="">All modules</option>
          {['product','purchase','inventory','sale','payment','crm','user','system'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="input w-36 text-sm" {...F('action')}>
          <option value="">All actions</option>
          {['create','update','delete','post','void','approve','reject','export','login','logout'].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
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
            ) : data?.data?.map(e => (
              <tr key={e.id} className="hover:bg-gray-50 text-xs">
                <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{format(new Date(e.created_at), 'd MMM yy HH:mm')}</td>
                <td className="px-4 py-2">{e.user?.name ?? 'System'}</td>
                <td className="px-4 py-2 capitalize">{e.module}</td>
                <td className="px-4 py-2"><span className="badge bg-blue-50 text-blue-600">{e.action}</span></td>
                <td className="px-4 py-2 text-gray-500">{e.record_type?.split('\\').pop()} #{e.record_id}</td>
                <td className="px-4 py-2 text-gray-400 max-w-xs truncate">{e.reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && (
          <div className="px-4 py-3 border-t flex justify-between text-xs text-gray-500">
            <span>Page {data.current_page} of {data.last_page}</span>
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
