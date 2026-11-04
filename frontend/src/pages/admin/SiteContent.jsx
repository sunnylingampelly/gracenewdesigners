import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { siteSettingsApi } from '../../api/client';
import { Building, Phone, Image, Home, Package, Layout, Search, Settings, Upload, X, Check, AlertCircle } from 'lucide-react';

const GROUPS = [
  { key: 'branding',    label: 'Branding',       icon: Building },
  { key: 'contact',     label: 'Contact & Hours', icon: Phone    },
  { key: 'hero',        label: 'Hero Section',    icon: Image    },
  { key: 'home',        label: 'Homepage',        icon: Home     },
  { key: 'collections', label: 'Collections',     icon: Package  },
  { key: 'footer',      label: 'Footer',          icon: Layout   },
  { key: 'seo',         label: 'SEO & Meta',      icon: Search   },
  { key: 'general',     label: 'General',         icon: Settings },
];

function ImageField({ fieldKey, currentValue, draft, onFileChange, onClear }) {
  const fileRef = useRef();
  const previewSrc = draft instanceof File
    ? URL.createObjectURL(draft)
    : draft === '' || draft === 'DELETE'
      ? null
      : currentValue
        ? `/storage/${currentValue}`
        : null;

  return (
    <div className="flex items-start gap-3 flex-wrap">
      {previewSrc && (
        <img
          src={previewSrc}
          alt="preview"
          className="w-24 h-24 object-cover rounded-lg border border-[#D4E2F4]"
        />
      )}
      {!previewSrc && (
        <div className="w-24 h-24 rounded-lg border-2 border-dashed border-[#D4E2F4] flex items-center justify-center bg-[#F5F8FF]">
          <Image size={20} className="text-[#6B82A8]" />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-3 py-1.5 text-xs border border-[#D4E2F4] rounded-lg text-[#1565C0] hover:bg-[#F5F8FF] transition-colors"
        >
          <Upload size={13} /> Upload Image
        </button>
        {(previewSrc || currentValue) && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-2 px-3 py-1.5 text-xs border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
          >
            <X size={13} /> Remove
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { if (e.target.files[0]) onFileChange(e.target.files[0]); }}
        />
      </div>
    </div>
  );
}

function BooleanToggle({ value, onChange }) {
  const isOn = value === '1' || value === true || value === 1;
  return (
    <button
      type="button"
      onClick={() => onChange(isOn ? '0' : '1')}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        isOn ? 'bg-[#1565C0]' : 'bg-[#D4E2F4]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          isOn ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function SiteContent() {
  const [activeGroup, setActiveGroup] = useState('branding');
  const [drafts, setDrafts] = useState({});
  const [toast, setToast] = useState(null); // 'success' | 'error'
  const qc = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['site-settings'],
    queryFn:  () => siteSettingsApi.get().then(r => r.data.data ?? r.data),
  });

  const settingsMap = useMemo(
    () => Object.fromEntries(settings.map(s => [s.key, s])),
    [settings]
  );

  const groupSettings = useMemo(
    () => settings.filter(s => s.group === activeGroup),
    [settings, activeGroup]
  );

  const val = key => key in drafts ? drafts[key] : (settingsMap[key]?.value ?? '');

  function setDraft(key, value) {
    setDrafts(prev => ({ ...prev, [key]: value }));
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      for (const s of groupSettings) {
        if (s.type === 'image') {
          const draft = drafts[s.key];
          if (draft instanceof File) {
            fd.append(`settings[${s.key}]`, draft);
          } else if (draft === '' || draft === 'DELETE') {
            fd.append(`settings[${s.key}]`, '');
          } else {
            fd.append(`settings[${s.key}]`, s.value ?? '');
          }
        } else {
          fd.append(`settings[${s.key}]`, val(s.key) ?? '');
        }
      }
      return siteSettingsApi.update(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-settings'] });
      // Clear only drafts for this group
      setDrafts(prev => {
        const next = { ...prev };
        for (const s of groupSettings) delete next[s.key];
        return next;
      });
      setToast('success');
      setTimeout(() => setToast(null), 2500);
    },
    onError: () => {
      setToast('error');
      setTimeout(() => setToast(null), 3000);
    },
  });

  const hasDrafts = groupSettings.some(s => s.key in drafts);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0A1628]">Site Content</h1>
          <p className="text-xs text-[#6B82A8] mt-0.5">
            Control every piece of text and image shown on your website from here.
          </p>
        </div>
        {toast === 'success' && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
            <Check size={14} /> Saved successfully
          </div>
        )}
        {toast === 'error' && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
            <AlertCircle size={14} /> Save failed — try again
          </div>
        )}
      </div>

      {/* Group Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {GROUPS.map(({ key, label, icon: Icon }) => {
          const active = activeGroup === key;
          return (
            <button
              key={key}
              onClick={() => setActiveGroup(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-[#1565C0] text-white shadow-sm'
                  : 'bg-white text-[#6B82A8] border border-[#D4E2F4] hover:bg-[#F5F8FF] hover:text-[#1565C0]'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Settings Panel */}
      <div className="bg-white border border-[#D4E2F4] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-[#6B82A8] text-sm">Loading settings…</div>
        ) : (
          <>
            <div className="divide-y divide-[#D4E2F4]">
              {groupSettings.map(s => (
                <div key={s.key} className="px-5 py-4">
                  <label className="block text-xs font-medium text-[#0A1628] mb-1.5">
                    {s.label}
                    <span className="ml-2 text-[#6B82A8] font-normal font-mono">{s.key}</span>
                  </label>

                  {s.type === 'text' && (
                    <input
                      type="text"
                      value={val(s.key)}
                      onChange={e => setDraft(s.key, e.target.value)}
                      className="w-full border border-[#D4E2F4] rounded-lg px-3 py-2 text-sm text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#29ABE2] focus:border-transparent bg-[#F5F8FF]"
                      placeholder={s.label}
                    />
                  )}

                  {s.type === 'textarea' && (
                    <textarea
                      rows={3}
                      value={val(s.key)}
                      onChange={e => setDraft(s.key, e.target.value)}
                      className="w-full border border-[#D4E2F4] rounded-lg px-3 py-2 text-sm text-[#0A1628] focus:outline-none focus:ring-2 focus:ring-[#29ABE2] focus:border-transparent bg-[#F5F8FF] resize-y"
                      placeholder={s.label}
                    />
                  )}

                  {s.type === 'image' && (
                    <ImageField
                      fieldKey={s.key}
                      currentValue={s.value}
                      draft={drafts[s.key]}
                      onFileChange={file => setDraft(s.key, file)}
                      onClear={() => setDraft(s.key, '')}
                    />
                  )}

                  {s.type === 'boolean' && (
                    <div className="flex items-center gap-3">
                      <BooleanToggle
                        value={val(s.key)}
                        onChange={v => setDraft(s.key, v)}
                      />
                      <span className="text-sm text-[#6B82A8]">
                        {val(s.key) === '1' ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-[#F5F8FF] border-t border-[#D4E2F4] flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-[#6B82A8]">
                {hasDrafts ? 'You have unsaved changes in this section.' : 'No unsaved changes.'}
              </p>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#1565C0] text-white rounded-lg hover:bg-[#1255A3] disabled:opacity-60 transition-colors"
              >
                {saveMutation.isPending ? 'Saving…' : (
                  <><Check size={14} /> Save Changes</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
