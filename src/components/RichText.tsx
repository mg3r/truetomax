"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

/** Older plain text becomes paragraphs; anything already formatted is kept as is. */
const toHtml = (v: string) =>
  /<\/?(p|h[1-3]|ul|ol|li|strong)\b/.test(v)
    ? v
    : v
        .split(/\n/)
        .filter((l) => l.trim())
        .map((l) => `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
        .join("");

/**
 * Text you write freely with simple formatting: titles, headings, bullets, numbered lists, bold.
 * The formatting bar shows while you're writing in it. Saves a moment after you stop typing, and when you leave.
 */
export function RichText({ value, onSave, className = "", label }: { value: string; onSave: (html: string) => void; className?: string; label: string }) {
  const [focused, setFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(toHtml(value));
  const save = (html: string) => {
    const clean = html === "<p></p>" ? "" : html;
    if (clean === last.current) return;
    last.current = clean;
    onSave(clean);
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false, code: false, blockquote: false, horizontalRule: false })],
    content: toHtml(value),
    editorProps: { attributes: { class: `vision-doc focus:outline-none ${className}`, "aria-label": label } },
    onFocus: () => setFocused(true),
    onUpdate: ({ editor }) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => save(editor.getHTML()), 1000);
    },
    onBlur: ({ editor }) => {
      setFocused(false);
      if (timer.current) clearTimeout(timer.current);
      save(editor.getHTML());
    },
  });

  useEffect(() => {
    const flush = () => editor && save(editor.getHTML());
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  });

  return (
    <div>
      {focused && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  const btn = (on: boolean) => `rounded-full px-2.5 py-0.5 text-xs ${on ? "bg-ink text-bg" : "text-muted hover:text-ink"}`;
  // onMouseDown keeps the cursor in the text while you tap a button.
  const keep = (e: React.MouseEvent) => e.preventDefault();
  return (
    <div className="mb-2 flex flex-wrap items-center gap-0.5 font-sans" role="toolbar" aria-label="Formatting">
      <button type="button" onMouseDown={keep} className={btn(editor.isActive("paragraph"))} onClick={() => editor.chain().focus().setParagraph().run()}>Text</button>
      <button type="button" onMouseDown={keep} className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>Heading</button>
      <button type="button" onMouseDown={keep} className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>Subheading</button>
      <span aria-hidden="true" className="mx-1 h-3 border-l border-line" />
      <button type="button" onMouseDown={keep} aria-label="Bullet list" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</button>
      <button type="button" onMouseDown={keep} aria-label="Numbered list" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</button>
      <button type="button" onMouseDown={keep} aria-label="Bold" className={`${btn(editor.isActive("bold"))} font-semibold`} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
    </div>
  );
}
