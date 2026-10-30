import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi, customersApi } from '../../api/client';
import { Plus, Search } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

const STATUS_COLORS = {
  new:                  'bg-blue-100 text-blue-700',
  contacted:            'bg-cyan-100 text-cyan-700',
  qualified:            'bg-indigo-100 text-indigo-700',
  consultation_planned: 'bg-purple-100 text-purple-700',
  quote_shared:         'bg-amber-100 text-amber-700',
  follow_up:            'bg-orange-100 text-orange-700',
  won:                  'bg-green-100 text-green-700',
  lost:                 'bg-red-100 text-red-700',
  not_proceeding:       'bg-gray-100 text-gray-500',
};

export default function CRM() {
  const [tab, setTab] = useState('leads'); // leads | customers
  const [search, setSearch] = useState('');
  const [showNewLead, setShowNewLead] = useState(false);
  const qc = useQueryClient();

  const { data: leads } = useQuery({
    queryKey: ['leads', search],
    queryFn:  () => leadsApi.list({ search, per_page: 50 }).then(r => r.data.data),
    enabled:  tab === 'leads',
  });

  const { data: customers } = useQuery({
    queryKey: ['customers', search],
    queryFn:  () => customersApi.list({ search, per_page: 50 }).then(r => r.data.data),
    enabled:  tab === 'customers',
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">CRM</h1>
        {tab === 'leads' && (
          <button onClick={() => setShowNewLead(true)} className="btn-primary">
            <Plus size={16} /> New Lead
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {['leads', 'customers'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-2 text-sm capitalize font-medium border-b-2 -mb-px transition-colors',
              tab === t ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t}
          </button>
        ))}
      </div>

      <div className="relative w-60">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-8 text-sm" placeholder="Search…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {tab === 'leads' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Occasion</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Follow-up</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads?.map(lead => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{lead.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{lead.phone}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs capitalize">{lead.source ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{lead.occasion ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {lead.follow_up_date
                      ? <span className={clsx(new Date(lead.follow_up_date) < new Date() ? 'text-red-600 font-medium' : 'text-gray-600')}>
                          {format(new Date(lead.follow_up_date), 'd MMM')}
                        </span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_COLORS[lead.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {lead.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{lead.assignee?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'customers' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Preferred Contact</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers?.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-xs capitalize">{c.preferred_contact}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{format(new Date(c.created_at), 'd MMM yy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNewLead && <NewLeadModal onClose={() => setShowNewLead(false)} onSaved={() => { setShowNewLead(false); qc.invalidateQueries({ queryKey: ['leads'] }); }} />}
    </div>
  );
}

function NewLeadModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', phone: '', source: 'walk_in', occasion: '', status: 'new', notes: '' });
  const mutation = useMutation({
    mutationFn: data => leadsApi.create(data),
    onSuccess:  onSaved,
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="font-semibold text-lg">New Lead</h2>
        {['name','phone','occasion'].map(f => (
          <div key={f}>
            <label className="label capitalize">{f}</label>
            <input className="input" value={form[f]} onChange={e => setForm(p => ({...p, [f]: e.target.value}))} />
          </div>
        ))}
        <div>
          <label className="label">Source</label>
          <select className="input" value={form.source} onChange={e => setForm(p => ({...p, source: e.target.value}))}>
            {['walk_in','whatsapp','referral','instagram','google'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Saving…' : 'Save Lead'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
