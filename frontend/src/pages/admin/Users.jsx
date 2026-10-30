import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/client';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';

export default function Users() {
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn:  () => usersApi.list().then(r => r.data.data ?? r.data),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users &amp; Access</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> New User</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left">
              {['Name','Email','Role','Status','Last Login'].map(h => (
                <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users?.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3"><span className="badge bg-gray-100 text-gray-600">{u.role?.display_name}</span></td>
                <td className="px-4 py-3">
                  <span className={`badge ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {u.is_active ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {u.last_login_at ? format(new Date(u.last_login_at), 'd MMM yy HH:mm') : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && <NewUserModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['users'] }); }} />}
    </div>
  );
}

function NewUserModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role_id: '' });
  const { data: rolesData } = useQuery({ queryKey: ['roles-list'], queryFn: () => import('../../api/client').then(m => m.default.get('/roles')).then(r => r.data) });
  const mutation = useMutation({ mutationFn: d => usersApi.create(d), onSuccess: onSaved });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="font-semibold text-lg">New User</h2>
        {['name','email','phone','password'].map(f => (
          <div key={f}><label className="label capitalize">{f}</label>
            <input className="input" type={f === 'password' ? 'password' : 'text'} value={form[f]}
              onChange={e => setForm(p => ({...p, [f]: e.target.value}))} /></div>
        ))}
        <div>
          <label className="label">Role</label>
          <select className="input" value={form.role_id} onChange={e => setForm(p => ({...p, role_id: e.target.value}))}>
            <option value="">Select role</option>
            {rolesData?.map?.(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
          </select>
        </div>
        <div className="flex gap-3">
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Creating…' : 'Create User'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
