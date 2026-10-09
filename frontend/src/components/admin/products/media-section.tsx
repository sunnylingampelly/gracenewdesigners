"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { MediaPickerDialog, MediaThumb, MediaUploader } from "@/components/admin/media-picker";
import { Button, Input, Select } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import type { OptionValue } from "./lookups";
import type { MediaRow } from "./types";

const ROLES: { value: MediaRow["role"]; label: string }[] = [
  { value: "gallery", label: "Gallery" },
  { value: "alternate", label: "Alternate angle" },
  { value: "detail", label: "Fabric close-up" },
  { value: "video", label: "Video" },
];

/** Product gallery: upload or pick, reorder by drag (or keyboard), set alt text, role and colour. First image is primary. */
export function MediaSection({ value, onChange, colors, error }: { value: MediaRow[]; onChange: (rows: MediaRow[]) => void; colors: OptionValue[]; error?: string }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = value.map((m) => String(m.media_asset_id));

  const add = (assets: { id: number; thumb_url: string | null; url: string; kind: string; original_name: string; alt_text: string | null }[]) => {
    const existing = new Set(value.map((m) => m.media_asset_id));
    const additions = assets.filter((a) => !existing.has(a.id)).map<MediaRow>((a) => ({
      media_asset_id: a.id,
      role: a.kind === "video" ? "video" : value.length === 0 ? "gallery" : "alternate",
      alt_text: a.alt_text ?? "",
      color_value_id: null,
      thumb_url: a.thumb_url ?? (a.kind === "image" ? a.url : null),
      kind: a.kind,
      name: a.original_name,
    }));
    onChange([...value, ...additions]);
  };

  const update = (index: number, patch: Partial<MediaRow>) => onChange(value.map((m, i) => (i === index ? { ...m, ...patch } : m)));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onChange(arrayMove(value, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };

  return (
    <div className="space-y-4">
      <MediaUploader compact onUploaded={(m) => add(m)} accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" folder="products" />
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Drag to reorder (or focus a handle and use the arrow keys with Space). The first image is the primary and listing image; the second appears on hover.</p>
        <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}><ImagePlus className="h-4 w-4" /> From library</Button>
      </div>
      {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
      {value.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No images yet. At least one image is required to publish.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {value.map((m, i) => (
                <SortableMedia key={m.media_asset_id} id={String(m.media_asset_id)}>
                  {(handle) => (
                    <div className={cn("rounded-lg border bg-white p-3", i === 0 ? "border-slate-900" : "border-slate-200")}>
                      <div className="flex gap-3">
                        <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded">
                          <MediaThumb media={{ kind: (m.kind as "image") ?? "image", thumb_url: m.thumb_url ?? null, url: m.thumb_url ?? "", alt_text: m.alt_text, original_name: m.name ?? `#${m.media_asset_id}` }} className="h-full w-full" />
                          {i === 0 && <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded bg-slate-900 px-1 text-[10px] text-white"><Star className="h-2.5 w-2.5" /> Primary</span>}
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center gap-1">
                            <button type="button" {...handle} className="cursor-grab rounded p-1 text-slate-400 hover:bg-slate-100" aria-label={`Reorder image ${i + 1}`}><GripVertical className="h-4 w-4" /></button>
                            <Select aria-label="Image role" value={m.role} onChange={(e) => update(i, { role: e.target.value as MediaRow["role"] })} className="h-8 text-xs">
                              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </Select>
                            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700" aria-label={`Remove image ${i + 1}`}><Trash2 className="h-4 w-4" /></button>
                          </div>
                          <Select aria-label="Colour shown" value={m.color_value_id ?? ""} onChange={(e) => update(i, { color_value_id: e.target.value ? Number(e.target.value) : null })} className="h-8 text-xs">
                            <option value="">All colours</option>
                            {colors.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </Select>
                        </div>
                      </div>
                      <Input aria-label={`Alt text for image ${i + 1}`} value={m.alt_text} onChange={(e) => update(i, { alt_text: e.target.value })} placeholder="Describe the image (alt text)" className={cn("mt-2 h-8 text-xs", !m.alt_text && "border-amber-300")} maxLength={300} />
                    </div>
                  )}
                </SortableMedia>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      <MediaPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} multiple kind="any" onSelect={(m) => add(m)} />
    </div>
  );
}

function SortableMedia({ id, children }: { id: string; children: (handle: Record<string, unknown>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && "z-10 opacity-80 shadow-lg")}>
      {children({ ...attributes, ...listeners })}
    </li>
  );
}
