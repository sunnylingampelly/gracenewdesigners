import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, rolesApi } from '../../api/client';
import { Plus, Trash2, ToggleLeft, ToggleRight, Shield, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { format } from 'date-fns';

const MODULES = [
  { key: 'dashboard',    label: 'Dashboard' },
  { key: 'sales',        label: 'Sales' },
  { key: 'crm',          label: 'CRM / Leads' },
  { key: 'catalogue',    label: 'Catalogue' },
  { key: 'inventory',    label: 'Inventory' },
  { key: 'purchases',    label: 'Purchases' },
  { key: 'categories',   label: 'Categories' },
  { key: 'site_content', label: 'Site Content' },
  { key: 'reports',      label: 'Reports' },
  { key: 'audit',        label: 'Audit Log' },
  { key: 'users',        label: 'User Management' },
];

export default function Users() {
  const [showForm,        setShowForm]        = useState(false);
  const [editUser,        setEditUser]        = useState(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const qc = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn:  () => usersApi.list().then(r => r.data.data ?? r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: id => usersApi.toggle(id),
    onSuccess:  ()  => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const removeMutation = useMutation({
    mutationFn: id => usersApi.remove(id),
    onSuccess:  ()  => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  function confirmRemove(u) {
    if (window.confirm(`Delete user "${u.name}"? This cannot be undone.`)) {
      removeMutation.mutate(u.id);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Users &amp; Access</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowPermissions(p => !p)}
            className="btn-secondary flex items-center gap-2">
            <Shield size={15} />
            Role Permissions
            {showPermissions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> New User
          </button>
        </div>
      </div>

      {/* ── Role Permissions Panel ── */}
      {showPermissions && <RolePermissionsPanel />}

      {/* ── Users Table ── */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left">
                {['Name', 'Email', 'Role', 'Status', 'Last Login', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-blue-50 text-blue-700">{u.role?.display_name ?? u.role_label ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {u.last_login_at ? format(new Date(u.last_login_at), 'd MMM yy HH:mm') : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 justify-end">
                      <button onClick={() => setEditUser(u)} title="Edit user"
                        className="text-gray-400 hover:text-blue-500 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => toggleMutation.mutate(u.id)}
                        title={u.is_active ? 'Deactivate' : 'Activate'}
                        className="text-gray-400 hover:text-blue-500 transition-colors">
                        {u.is_active
                          ? <ToggleRight size={20} className="text-green-500" />
                          : <ToggleLeft size={20} />}
                      </button>
                      <button onClick={() => confirmRemove(u)}
                        className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">No users yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <NewUserModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['users'] }); }}
        />
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); qc.invalidateQueries({ queryKey: ['users'] }); }}
        />
      )}
    </div>
  );
}

// ── Role Permissions Panel ────────────────────────────────────────────────────

function RolePermissionsPanel() {
  const qc = useQueryClient();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn:  () => rolesApi.list().then(r => r.data.data ?? r.data),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, permissions }) => rolesApi.updatePermissions(id, permissions),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });

  // local draft state: { roleId: Set<module> }
  const [drafts, setDrafts] = useState({});

  function getPerms(role) {
    if (drafts[role.id] !== undefined) return drafts[role.id];
    const perms = role.permissions ?? [];
    return new Set(Array.isArray(perms) ? perms : Object.keys(perms).filter(k => perms[k]));
  }

  function toggle(role, moduleKey) {
    const current = getPerms(role);
    const next = new Set(current);
    if (next.has(moduleKey)) next.delete(moduleKey); else next.add(moduleKey);
    setDrafts(d => ({ ...d, [role.id]: next }));
  }

  function toggleAll(role) {
    const current = getPerms(role);
    const allSelected = MODULES.every(m => current.has(m.key));
    const next = allSelected ? new Set() : new Set(MODULES.map(m => m.key));
    setDrafts(d => ({ ...d, [role.id]: next }));
  }

  function save(role) {
    const perms = [...getPerms(role)];
    saveMutation.mutate({ id: role.id, permissions: perms });
    setDrafts(d => { const n = {...d}; delete n[role.id]; return n; });
  }

  if (isLoading) return <div className="card py-8 text-center text-sm text-gray-400">Loading roles…</div>;

  return (
    <div className="card space-y-5">
      <h2 className="font-semibold text-sm flex items-center gap-2"><Shield size={15} className="text-blue-500" /> Role &amp; Module Permissions</h2>
      <p className="text-xs text-gray-400">Control which modules each role can access. <span className="font-medium text-gray-600">Super Admin</span> always has full access.</p>

      <div className="space-y-6">
        {roles
          .filter(r => r.name !== 'super_admin')
          .map(role => {
            const perms     = getPerms(role);
            const isDirty   = drafts[role.id] !== undefined;
            const allOn     = MODULES.every(m => perms.has(m.key));

            return (
              <div key={role.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-medium text-sm">{role.display_name}</p>
                    <p className="text-xs text-gray-400">{role.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleAll(role)}
                      className="text-xs text-blue-600 hover:underline">
                      {allOn ? 'Remove all' : 'Grant all'}
                    </button>
                    {isDirty && (
                      <button onClick={() => save(role)}
                        disabled={saveMutation.isPending}
                        className="btn-primary text-xs py-1.5 px-3">
                        {saveMutation.isPending ? 'Saving…' : 'Save changes'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {MODULES.map(mod => {
                    const on = perms.has(mod.key);
                    return (
                      <label key={mod.key}
                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm transition-colors select-none ${
                          on
                            ? 'border-blue-300 bg-blue-50 text-blue-800'
                            : 'border-gray-200 text-gray-400 hover:border-gray-300'
                        }`}>
                        <input type="checkbox" className="sr-only"
                          checked={on}
                          onChange={() => toggle(role, mod.key)} />
                        <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                          on ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                        }`}>
                          {on && <svg viewBox="0 0 10 8" fill="none" className="w-2.5 h-2.5">
                            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>}
                        </span>
                        {mod.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ── Edit User Modal ───────────────────────────────────────────────────────────

function EditUserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:     user.name     ?? '',
    phone:    user.phone    ?? '',
    role_id:  user.role?.id ?? '',
    password: '',
  });
  const [error, setError] = useState('');

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn:  () => rolesApi.list().then(r => r.data.data ?? r.data),
  });

  const mutation = useMutation({
    mutationFn: d => usersApi.update(user.id, d),
    onSuccess:  onSaved,
    onError:    err => setError(err.response?.data?.message || 'Failed to update user.'),
  });

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  function submit() {
    const payload = { name: form.name, phone: form.phone, role_id: form.role_id };
    if (form.password.trim()) payload.password = form.password;
    mutation.mutate(payload);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="font-semibold text-lg">Edit User — {user.name}</h2>
        <p className="text-xs text-gray-400">{user.email}</p>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>}

        <div>
          <label className="label">Full Name *</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <div>
          <label className="label">Role *</label>
          <select className="input" value={form.role_id} onChange={e => set('role_id', e.target.value)} required>
            <option value="">— Select role —</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span></label>
          <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={submit} disabled={mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── New User Modal ────────────────────────────────────────────────────────────

function NewUserModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role_id: '' });
  const [error, setError] = useState('');

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn:  () => rolesApi.list().then(r => r.data.data ?? r.data),
  });

  const mutation = useMutation({
    mutationFn: d => usersApi.create(d),
    onSuccess:  onSaved,
    onError:    err => setError(err.response?.data?.message || 'Failed to create user.'),
  });

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="font-semibold text-lg">New User</h2>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</p>}

        <div>
          <label className="label">Full Name *</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div>
          <label className="label">Email *</label>
          <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <div>
          <label className="label">Password *</label>
          <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} required />
        </div>
        <div>
          <label className="label">Role *</label>
          <select className="input" value={form.role_id} onChange={e => set('role_id', e.target.value)} required>
            <option value="">— Select role —</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
          </select>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="btn-primary flex-1">
            {mutation.isPending ? 'Creating…' : 'Create User'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
