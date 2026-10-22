"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { toJpeg } from "@/lib/images";
import { SECTIONS, photoUrl, catalogNo, type PortfolioItem } from "@/lib/portfolio";
import { addPortfolioItems, deletePortfolioItem, reorderPortfolio, updatePortfolioItem } from "@/app/actions";
import { Grow } from "./Grow";

/**
 * Your portfolio, managed in place: drop or pick photos to upload, drag to reorder,
 * type a title and description under each, hide one without deleting it, or delete it.
 */
export function PortfolioAdmin({ section, items: initial, counts, userId, pageText = null }: { section: string; items: PortfolioItem[]; counts: Record<string, number>; userId: string; pageText?: React.ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setItems(initial), [initial]);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }));

  async function upload(files: File[]) {
    const photos = files.filter((f) => f.type.startsWith("image/") || /\.hei[cf]$/i.test(f.name));
    if (!photos.length) return;
    setNote(null);
    setUploading({ done: 0, total: photos.length });
    const supabase = createClient();
    const added: { section: string; image_path: string; width: number; height: number }[] = [];
    let failed = 0;
    for (const f of photos) {
      try {
        // Upright, web-sized JPEG: sharp on a big screen, quick on a phone.
        const { blob, width, height } = await toJpeg(f, 2400, 0.86);
        const path = `${userId}/${section}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from("portfolio").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (error) throw error;
        added.push({ section, image_path: path, width, height });
      } catch (e) {
        console.error("portfolio upload", e);
        failed++;
      }
      setUploading((u) => (u ? { ...u, done: u.done + 1 } : u));
    }
    if (added.length) await addPortfolioItems(added);
    setUploading(null);
    setNote(failed ? `${added.length} added. ${failed} couldn't be uploaded; try those again.` : `${added.length} added. Drag to put them in order, and add a title or description if you like.`);
    router.refresh();
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((i) => i.id === e.active.id);
    const to = items.findIndex((i) => i.id === e.over!.id);
    const next = arrayMove(items, from, to);
    setItems(next);
    start(() => reorderPortfolio(next.map((i) => i.id)));
  }

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-1" aria-label="Sections">
        {SECTIONS.map((s) => (
          <Link key={s.id} href={`/portfolio?s=${s.id}`} className={`rounded-full px-3 py-1 text-sm ${s.id === section ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>
            {s.title}
            {counts[s.id] ? <span className="ml-1.5 tabular-nums opacity-70">{counts[s.id]}</span> : null}
          </Link>
        ))}
      </nav>

      {/* This section's page title and description, as they read on the site. */}
      {pageText}

      {/* Drop photos here, or tap to pick them (on a phone: your photo library or the camera). */}
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload(Array.from(e.dataTransfer.files));
        }}
        className={`pebble grid place-items-center border border-dashed px-4 py-8 text-center transition-colors ${over ? "border-clay bg-surface" : "border-line"}`}
      >
        {uploading ? (
          <p className="text-muted">
            Uploading {uploading.done} of {uploading.total}…
          </p>
        ) : (
          <>
            <button type="button" onClick={() => input.current?.click()} className="btn">
              Add photos
            </button>
            <p className="mt-2 text-sm text-muted">or drop them here. iPhone photos are fine; they&rsquo;re sized for the web for you.</p>
          </>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            upload(files);
          }}
        />
      </div>
      {note && (
        <p role="status" className="text-sm text-muted">
          {note}
        </p>
      )}

      {items.length ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
              {items.map((it) => (
                <Card
                  key={it.id}
                  item={it}
                  onChange={(patch) => setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, ...patch } : x)))}
                  onDelete={() => {
                    setItems((xs) => xs.filter((x) => x.id !== it.id));
                    start(() => deletePortfolioItem(it.id));
                  }}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        !uploading && <p className="text-muted">No photos here yet.</p>
      )}
    </div>
  );
}

function Card({ item, onChange, onDelete }: { item: PortfolioItem; onChange: (patch: Partial<PortfolioItem>) => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [title, setTitle] = useState(item.title ?? "");
  const [description, setDescription] = useState(item.description ?? "");
  const [, start] = useTransition();
  const save = (fields: Parameters<typeof updatePortfolioItem>[1]) => {
    onChange(fields as Partial<PortfolioItem>);
    start(() => updatePortfolioItem(item.id, fields));
  };

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`group ${isDragging ? "z-10 opacity-80" : ""}`}>
      <div
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        aria-label="Drag to reorder"
        className={`relative aspect-square cursor-grab touch-none overflow-hidden rounded-xl bg-surface ${item.published ? "" : "opacity-40"}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl(item.image_path)} alt={item.title ?? ""} className="h-full w-full object-cover" draggable={false} />
        {!item.published && <span className="absolute top-2 left-2 rounded-full bg-bg/90 px-2 py-0.5 text-xs">Hidden</span>}
        {catalogNo(item.number) && <span className="absolute right-2 bottom-2 rounded-full bg-bg/85 px-2 py-0.5 text-xs tabular-nums">{catalogNo(item.number)}</span>}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() !== (item.title ?? "") && save({ title })}
        placeholder="Title"
        aria-label="Title"
        className="mt-2 w-full bg-transparent font-serif text-lg placeholder:text-muted/70 focus:outline-none"
      />
      <Grow
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => description.trim() !== (item.description ?? "") && save({ description })}
        placeholder="Description"
        aria-label="Description"
        className="block w-full resize-none bg-transparent text-sm text-muted placeholder:text-muted/60 focus:text-ink focus:outline-none"
      />
      <div className="mt-1 flex gap-3 text-xs text-muted">
        <button type="button" onClick={() => save({ published: !item.published })} className="hover:text-ink">
          {item.published ? "Hide" : "Show on site"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Delete this photo from your portfolio for good?")) onDelete();
          }}
          className="hover:text-danger"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
