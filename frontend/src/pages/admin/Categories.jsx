import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '../../api/client';
import { Plus, Edit2, Trash2 } from 'lucide-react';

export default function Categories() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => categoriesApi.adminList().then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: id => categoriesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-categories'] }),
    onError: err => alert(err.response?.data?.message ?? 'Delete failed'),
  });

  const categories = Array.isArray(data) ? data : (data?.data ?? []);

  if (isLoading) return <div className="p-8 text-gray-400">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Categories</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> New Category
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
              <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
              <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-16">Order</th>
              <th className="pb-3 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {categories.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400 text-sm">
                  No categories yet. Create one to get started.
                </td>
              </tr>
            )}
            {categories.map(cat => (
              <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 font-medium text-gray-900">{cat.name}</td>
                <td className="py-3 text-gray-500">{cat.description ?? '—'}</td>
                <td className="py-3 text-gray-400">{cat.sort_order ?? 0}</td>
                <td className="py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => { setEditing(cat); setShowForm(true); }}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${cat.name}"?`)) deleteMutation.mutate(cat.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <CategoryForm
          category={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['admin-categories'] }); }}
        />
      )}
    </div>
  );
}

function CategoryForm({ category, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:        category?.name ?? '',
    description: category?.description ?? '',
    sort_order:  category?.sort_order ?? 0,
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: data =>
      category ? categoriesApi.update(category.id, data) : categoriesApi.create(data),
    onSuccess: onSaved,
    onError: err => setError(err.response?.data?.message ?? 'Save failed'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="font-semibold text-lg">{category ? 'Edit Category' : 'New Category'}</h2>

        <div>
          <label className="label">Name *</label>
          <input
            className="input"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Sherwani"
            required
          />
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            className="input"
            rows={2}
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Optional description"
          />
        </div>

        <div>
          <label className="label">Sort Order</label>
          <input
            className="input w-24"
            type="number"
            min={0}
            value={form.sort_order}
            onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))}
          />
          <p className="text-xs text-gray-400 mt-1">Lower numbers appear first</p>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending || !form.name.trim()}
            className="btn-primary"
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
