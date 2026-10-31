import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '../../api/client';
import { Plus, Edit2, Trash2, Upload, X, Image } from 'lucide-react';

export default function Categories() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn:  () => categoriesApi.adminList().then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: id => categoriesApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin-categories'] }),
    onError:    err => alert(err.response?.data?.message ?? 'Delete failed'),
  });

  const categories = Array.isArray(data) ? data : (data?.data ?? []);

  if (isLoading) return <div className="p-8 text-gray-400">Loading…</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Categories</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Category
        </button>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {categories.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No categories yet.</p>
        )}
        {categories.map(cat => (
          <div key={cat.id} className="card flex items-center gap-3">
            <div className="w-14 h-14 rounded bg-gray-100 overflow-hidden shrink-0">
              {cat.image_path
                ? <img src={`/storage/${cat.image_path}`} alt={cat.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Image size={20} className="text-gray-300" /></div>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{cat.name}</p>
              <p className="text-xs text-gray-400 truncate">{cat.description ?? '—'}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => { setEditing(cat); setShowForm(true); }}
                className="p-2 text-gray-400 hover:text-gray-700 rounded"><Edit2 size={14} /></button>
              <button onClick={() => { if (confirm(`Delete "${cat.name}"?`)) deleteMutation.mutate(cat.id); }}
                className="p-2 text-gray-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="card overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-16">Image</th>
              <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
              <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
              <th className="pb-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-16">Order</th>
              <th className="pb-3 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {categories.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-gray-400 text-sm">No categories yet.</td></tr>
            )}
            {categories.map(cat => (
              <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3">
                  <div className="w-12 h-12 rounded bg-gray-100 overflow-hidden">
                    {cat.image_path
                      ? <img src={`/storage/${cat.image_path}`} alt={cat.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Image size={16} className="text-gray-300" /></div>
                    }
                  </div>
                </td>
                <td className="py-3 font-medium text-gray-900">{cat.name}</td>
                <td className="py-3 text-gray-500 max-w-xs truncate">{cat.description ?? '—'}</td>
                <td className="py-3 text-gray-400">{cat.sort_order ?? 0}</td>
                <td className="py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => { setEditing(cat); setShowForm(true); }}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition-colors" title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => { if (confirm(`Delete "${cat.name}"?`)) deleteMutation.mutate(cat.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors" title="Delete">
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
    name:        category?.name        ?? '',
    description: category?.description ?? '',
    sort_order:  category?.sort_order  ?? 0,
  });
  const [imageFile, setImageFile]     = useState(null);
  const [imagePreview, setImagePreview] = useState(
    category?.image_path ? `/storage/${category.image_path}` : null
  );
  const [error, setError] = useState('');
  const fileRef = useRef();

  function handleImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  const mutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('name',        form.name);
      fd.append('description', form.description);
      fd.append('sort_order',  form.sort_order);
      if (imageFile) fd.append('image', imageFile);
      // Laravel PUT via POST + _method for multipart
      if (category) fd.append('_method', 'PUT');
      return category
        ? categoriesApi.update(category.id, fd)
        : categoriesApi.create(fd);
    },
    onSuccess: onSaved,
    onError:   err => setError(err.response?.data?.message ?? 'Save failed'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">{category ? 'Edit Category' : 'New Category'}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        {/* Image upload */}
        <div>
          <label className="label">Category Image</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors overflow-hidden"
          >
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs font-medium">Click to change</p>
                </div>
              </div>
            ) : (
              <div className="h-32 flex flex-col items-center justify-center gap-2 text-gray-400">
                <Upload size={24} />
                <p className="text-xs">Click to upload image</p>
                <p className="text-xs text-gray-300">JPG, PNG, WEBP — max 5MB</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
        </div>

        <div>
          <label className="label">Name *</label>
          <input className="input" value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Sherwani" required />
        </div>

        <div>
          <label className="label">Description</label>
          <textarea className="input" rows={2} value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Optional description" />
        </div>

        <div>
          <label className="label">Sort Order</label>
          <input className="input w-24" type="number" min={0} value={form.sort_order}
            onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))} />
          <p className="text-xs text-gray-400 mt-1">Lower numbers appear first</p>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name.trim()}
            className="btn-primary flex-1">
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
