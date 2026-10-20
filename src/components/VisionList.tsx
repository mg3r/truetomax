"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RichText } from "./RichText";
import { updateVision, createVision, deleteVision, reorderVisions } from "@/app/actions";

type Vision = { id: string; title: string; body: string };

/** One running doc: each vision is a heading and its text. New ones go on top; drag the handle to reorder. */
export function VisionDoc({ visions: initial }: { visions: Vision[] }) {
  const [visions, setVisions] = useState(initial);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [, start] = useTransition();
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }));

  async function addAtTop() {
    const created = await createVision("");
    if (!created) return;
    setVisions((vs) => [{ id: created.id, title: "Untitled vision", body: "" }, ...vs]);
    setFocusId(created.id);
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = visions.findIndex((v) => v.id === e.active.id);
    const to = visions.findIndex((v) => v.id === e.over!.id);
    const next = arrayMove(visions, from, to);
    setVisions(next);
    start(() => reorderVisions(next.map((v) => v.id)));
  }

  return (
    <div>
      <button onClick={addAtTop} className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
        New vision
      </button>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={visions.map((v) => v.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-6">
            {visions.map((v, i) => (
              <Section
                key={v.id}
                v={v}
                first={i === 0}
                autoFocus={focusId === v.id}
                onDelete={() => {
                  setVisions((vs) => vs.filter((x) => x.id !== v.id));
                  start(() => deleteVision(v.id));
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {!visions.length && <p className="mt-4 text-muted">Nothing here yet. Tap New vision and write what&rsquo;s alive for you today.</p>}
    </div>
  );
}

function Section({ v, first, autoFocus, onDelete }: { v: Vision; first: boolean; autoFocus: boolean; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: v.id });
  const [title, setTitle] = useState(v.title);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [, start] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) titleRef.current?.select();
  }, [autoFocus]);

  function save(fields: { title?: string; body?: string }) {
    start(async () => {
      await updateVision(v.id, fields);
      setSaved(true);
      setTimeout(() => setSaved(false), 1400);
    });
  }

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative ${first ? "" : "mt-10"} ${isDragging ? "z-10 opacity-80" : ""}`}
    >
      {/* Drag handle: sits in the margin, appears on hover or while editing */}
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        aria-label={`Drag to reorder ${title}`}
        className="absolute top-2 -left-6 hidden cursor-grab touch-none text-muted opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 sm:block"
      >
        <svg width="12" height="18" viewBox="0 0 12 18" aria-hidden="true">
          {[3, 9, 15].map((y) => [3, 9].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="currentColor" />))}
        </svg>
      </button>

      <input
        ref={titleRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() && title !== v.title && save({ title })}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        aria-label="Vision name"
        className="w-full bg-transparent font-serif text-[1.7rem] leading-tight tracking-[-0.01em] focus:outline-none"
      />
      <div className="mt-2">
        <RichText value={v.body} label={`${title} text`} onSave={(html) => save({ body: html })} className="min-h-[1.75em]" />
      </div>
      <div className="flex h-5 items-center gap-4 text-xs text-muted">
        <span aria-live="polite">{saved ? "Saved" : ""}</span>
        <span className="flex-1" />
        {/* Phones can't hover: the handle's job is done by these while editing */}
        {confirming ? (
          <>
            <button className="hover:text-danger" onClick={onDelete}>Remove it</button>
            <button className="hover:text-ink" onClick={() => setConfirming(false)}>Keep</button>
          </>
        ) : (
          <button className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-danger focus:opacity-100" onClick={() => setConfirming(true)}>
            Remove
          </button>
        )}
        <span
          {...listeners}
          aria-hidden="true"
          className="cursor-grab touch-none opacity-0 transition-opacity group-focus-within:opacity-100 sm:hidden"
        >
          Hold to move
        </span>
      </div>
      <hr className="mt-6 border-line" />
    </section>
  );
}
