import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi, categoriesApi } from '../../api/client';
import { Plus, Edit, Eye, EyeOff, Upload, Trash2, Star } from 'lucide-react';

const STATUS = { published: 'bg-green-100 text-green-700', draft: 'bg-gray-100 text-gray-500', archived: 'bg-red-50 text-red-500' };

export default function Products() {
  const [filters, setFilters] = useState({ status: '', category_id: '', search: '', page: 1 });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['products', filters],
    queryFn:  () => productsApi.list(filters).then(r => r.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn:  () => categoriesApi.list().then(r => r.data),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }) => productsApi.update(id, { status }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  const catList = Array.isArray(categories) ? categories : (categories?.data ?? []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Catalogue</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Product
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input className="input w-52 text-sm" placeholder="Search name…"
          value={filters.search} onChange={e => setFilters(p => ({...p, search: e.target.value, page: 1}))} />
        <select className="input w-36 text-sm" value={filters.status}
          onChange={e => setFilters(p => ({...p, status: e.target.value, page: 1}))}>
          <option value="">All statuses</option>
          {['draft','published','archived'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input w-44 text-sm" value={filters.category_id}
          onChange={e => setFilters(p => ({...p, category_id: e.target.value, page: 1}))}>
          <option value="">All categories</option>
          {catList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.data?.map(p => (
          <div key={p.id} className="card flex flex-col gap-3">
            <div className="aspect-[4/3] bg-gray-100 rounded overflow-hidden flex items-center justify-center text-gray-300 text-xs">
              {p.primary_image
                ? <img src={`/storage/${p.primary_image.path}`} className="w-full h-full object-cover" alt={p.name} />
                : 'No image'}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-sm leading-tight">{p.name}</p>
                <span className={`badge ${STATUS[p.status]}`}>{p.status}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{p.category?.name} · {p.variants?.length ?? 0} variant{p.variants?.length !== 1 ? 's' : ''}</p>
              {p.occasion && <p className="text-xs text-gray-400 capitalize">{p.occasion}</p>}
            </div>
            <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
              <button onClick={() => { setEditing(p); setShowForm(true); }}
                className="btn btn-secondary py-1 px-2 text-xs flex items-center gap-1"><Edit size={12} /> Edit</button>
              <button
                onClick={() => toggleStatus.mutate({ id: p.id, status: p.status === 'published' ? 'draft' : 'published' })}
                className="btn btn-secondary py-1 px-2 text-xs flex items-center gap-1">
                {p.status === 'published' ? <><EyeOff size={12} /> Unpublish</> : <><Eye size={12} /> Publish</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <ProductForm
          product={editing}
          categories={catList}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['products'] }); }}
        />
      )}
    </div>
  );
}

function ProductForm({ product, categories, onClose, onSaved }) {
  const [tab, setTab] = useState('details');
  const [form, setForm] = useState({
    name:        product?.name ?? '',
    category_id: product?.category_id ?? '',
    description: product?.description ?? '',
    fabric:      product?.fabric ?? '',
    occasion:    product?.occasion ?? '',
    status:      product?.status ?? 'draft',
    show_price:  product?.show_price ?? false,
  });
  const [savedId, setSavedId] = useState(product?.id ?? null);

  const mutation = useMutation({
    mutationFn: data => product
      ? productsApi.update(product.id, data)
      : productsApi.create(data),
    onSuccess: res => {
      if (!product) setSavedId(res.data.id);
      onSaved();
    },
  });

  const F = field => ({
    value:    form[field],
    onChange: e => setForm(p => ({ ...p, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0 shrink-0">
          <h2 className="font-semibold text-lg">{product ? 'Edit Product' : 'New Product'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Tabs — only show Images tab when product already exists */}
        <div className="flex gap-1 px-6 pt-4 border-b border-gray-100 shrink-0">
          {['details', ...(savedId ? ['images'] : [])].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-brand-500 text-brand-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {tab === 'details' && (
            <div className="space-y-4">
              <div><label className="label">Name *</label><input className="input" {...F('name')} required /></div>
              <div>
                <label className="label">Category *</label>
                <select className="input" {...F('category_id')}>
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label className="label">Description</label><textarea className="input" rows={3} {...F('description')} /></div>
              <div><label className="label">Fabric</label><input className="input" {...F('fabric')} /></div>
              <div>
                <label className="label">Occasion</label>
                <select className="input" {...F('occasion')}>
                  <option value="">— Any —</option>
                  {['wedding','formal','festive','casual','black-tie'].map(o => (
                    <option key={o} value={o} className="capitalize">{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" {...F('status')}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.show_price}
                  onChange={e => setForm(p => ({...p, show_price: e.target.checked}))} />
                Show price on website
              </label>

              <div className="flex gap-3 pt-1">
                <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending} className="btn-primary">
                  {mutation.isPending ? 'Saving…' : (product ? 'Save Changes' : 'Create Product')}
                </button>
                <button onClick={onClose} className="btn-secondary">Cancel</button>
              </div>
              {mutation.error && (
                <p className="text-red-600 text-sm">{mutation.error.response?.data?.message ?? 'Save failed'}</p>
              )}
            </div>
          )}

          {tab === 'images' && savedId && (
            <ImageManager productId={savedId} />
          )}
        </div>
      </div>
    </div>
  );
}

function ImageManager({ productId }) {
  const qc = useQueryClient();
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const { data: product, isLoading } = useQuery({
    queryKey: ['product-images', productId],
    queryFn:  () => productsApi.get(productId).then(r => r.data),
  });

  const images = product?.images ?? [];

  const deleteMutation = useMutation({
    mutationFn: imgId => productsApi.deleteImage(productId, imgId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['product-images', productId] }),
    onError:    err => setError(err.response?.data?.message ?? 'Delete failed'),
  });

  const setPrimaryMutation = useMutation({
    mutationFn: imgId => productsApi.setPrimaryImage(productId, imgId),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['product-images', productId] }); qc.invalidateQueries({ queryKey: ['products'] }); },
    onError:    err => setError(err.response?.data?.message ?? 'Failed to set primary'),
  });

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('is_primary', images.length === 0 ? '1' : '0');
      await productsApi.uploadImage(productId, fd);
      qc.invalidateQueries({ queryKey: ['product-images', productId] });
      qc.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      setError(err.response?.data?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      fileRef.current.value = '';
    }
  }

  if (isLoading) return <div className="text-gray-400 text-sm">Loading images…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{images.length} image{images.length !== 1 ? 's' : ''}</p>
        <label className={`btn-primary flex items-center gap-2 cursor-pointer text-sm ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload size={14} />
          {uploading ? 'Uploading…' : 'Upload Image'}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </label>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {images.length === 0 && (
        <div className="border-2 border-dashed border-gray-200 rounded-lg py-12 flex flex-col items-center gap-3 text-gray-400">
          <Upload size={32} strokeWidth={1} />
          <p className="text-sm">No images yet. Upload the first one.</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {images.map(img => (
          <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200">
            <img
              src={`/storage/${img.path}`}
              alt=""
              className="w-full aspect-square object-cover"
            />
            {img.is_primary && (
              <span className="absolute top-1.5 left-1.5 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                <Star size={10} fill="white" /> Primary
              </span>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              {!img.is_primary && (
                <button
                  onClick={() => setPrimaryMutation.mutate(img.id)}
                  className="bg-amber-500 text-white rounded p-1.5 hover:bg-amber-600 transition-colors"
                  title="Set as primary"
                >
                  <Star size={14} />
                </button>
              )}
              <button
                onClick={() => { if (confirm('Delete this image?')) deleteMutation.mutate(img.id); }}
                className="bg-red-600 text-white rounded p-1.5 hover:bg-red-700 transition-colors"
                title="Delete image"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400">
        First uploaded image becomes primary automatically. JPG/PNG/WebP, max 5 MB each.
      </p>
    </div>
  );
}
