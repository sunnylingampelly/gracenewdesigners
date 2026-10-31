import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { siteSettingsApi } from '../../api/client';
import { Save, Upload, Eye } from 'lucide-react';

const GROUPS = [
  { key: 'hero',    label: 'Hero Section' },
  { key: 'home',    label: 'Home Page'    },
  { key: 'general', label: 'General'      },
];

export default function SiteContent() {
  const qc = useQueryClient();
  const [activeGroup, setActiveGroup] = useState('hero');
  const [localValues, setLocalValues] = useState({});
  const [imageFiles,  setImageFiles]  = useState({});
  const [imagePreviews, setImagePreviews] = useState({});
  const [saved, setSaved] = useState(false);
  const fileRefs = useRef({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ['site-settings-admin'],
    queryFn:  () => siteSettingsApi.get().then(r => r.data),
    onSuccess: data => {
      const vals = {};
      Object.values(data).forEach(s => { vals[s.key] = s.value ?? ''; });
      setLocalValues(vals);
    },
  });

  // merge server data into localValues on first load
  const serverVals = {};
  if (settings) Object.values(settings).forEach(s => { serverVals[s.key] = s.value ?? ''; });
  const merged = { ...serverVals, ...localValues };

  const groupSettings = settings
    ? Object.values(settings).filter(s => s.group === activeGroup)
    : [];

  const mutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(merged).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
      Object.entries(imageFiles).forEach(([k, f]) => { fd.append(k, f); });
      return siteSettingsApi.update(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-settings-admin'] });
      setImageFiles({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  function handleImageChange(key, e) {
    const file = e.target.files[0];
    if (!file) return;
    setImageFiles(p  => ({ ...p, [key]: file }));
    setImagePreviews(p => ({ ...p, [key]: URL.createObjectURL(file) }));
  }

  if (isLoading) return <div className="p-8 text-gray-400">Loading…</div>;

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Site Content</h1>
          <p className="text-xs text-gray-400 mt-0.5">Edit text and images shown on the public website</p>
        </div>
        <div className="flex gap-3">
          <a href="/" target="_blank" rel="noopener"
            className="btn-secondary flex items-center gap-2 text-xs">
            <Eye size={14} /> Preview Site
          </a>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="btn-primary flex items-center gap-2">
            <Save size={14} /> {mutation.isPending ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Group tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {GROUPS.map(g => (
          <button key={g.key} onClick={() => setActiveGroup(g.key)}
            className={`px-4 py-2 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeGroup === g.key
                ? 'border-blue-600 text-blue-600 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {g.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {groupSettings.map(setting => (
          <div key={setting.key}>
            <label className="label">{setting.label ?? setting.key}</label>

            {setting.type === 'image' ? (
              <div>
                <div
                  onClick={() => {
                    if (!fileRefs.current[setting.key]) fileRefs.current[setting.key] = document.createElement('input');
                    const inp = fileRefs.current[setting.key];
                    inp.type = 'file'; inp.accept = 'image/*';
                    inp.onchange = e => handleImageChange(setting.key, e);
                    inp.click();
                  }}
                  className="border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors overflow-hidden"
                >
                  {(imagePreviews[setting.key] || merged[setting.key]) ? (
                    <div className="relative group">
                      <img
                        src={imagePreviews[setting.key] || `/storage/${merged[setting.key]}`}
                        alt={setting.label}
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-xs font-medium flex items-center gap-2"><Upload size={14}/> Click to change</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-32 flex flex-col items-center justify-center gap-2 text-gray-400">
                      <Upload size={24} />
                      <p className="text-xs">Click to upload image</p>
                    </div>
                  )}
                </div>
                {merged[setting.key] && (
                  <button
                    onClick={() => { setLocalValues(p => ({ ...p, [setting.key]: '' })); setImagePreviews(p => ({ ...p, [setting.key]: null })); }}
                    className="text-xs text-red-500 mt-1 hover:underline">Remove image</button>
                )}
              </div>
            ) : setting.type === 'textarea' ? (
              <textarea className="input" rows={3}
                value={merged[setting.key] ?? ''}
                onChange={e => setLocalValues(p => ({ ...p, [setting.key]: e.target.value }))}
              />
            ) : (
              <input className="input"
                value={merged[setting.key] ?? ''}
                onChange={e => setLocalValues(p => ({ ...p, [setting.key]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>

      {groupSettings.length === 0 && (
        <p className="text-gray-400 text-sm py-8 text-center">
          No settings in this group yet. Run the database seeder to populate defaults.
        </p>
      )}

      <div className="mt-8 pt-6 border-t border-gray-100">
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="btn-primary w-full flex items-center justify-center gap-2">
          <Save size={14} /> {mutation.isPending ? 'Saving…' : 'Save All Changes'}
        </button>
      </div>
    </div>
  );
}
