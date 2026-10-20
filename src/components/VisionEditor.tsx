"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { saveVisionDoc } from "@/app/actions";

/** One page for your vision, written freely. Titles, bullets and numbered lists, like a simple doc; it saves as you go. */
export function VisionEditor({ initial }: { initial: string }) {
  const [state, setState] = useState<"saved" | "saving" | "error" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(initial);

  const save = (html: string) => {
    if (html === last.current) return;
    setState("saving");
    saveVisionDoc(html).then((r) => {
      if (r.error) {
        setError(r.error);
        setState("error");
      } else {
        last.current = html;
        setError(null);
        setState("saved");
      }
    });
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false, code: false, blockquote: false, horizontalRule: false }),
      Placeholder.configure({ placeholder: "" }),
    ],
    content: initial,
    editorProps: { attributes: { class: "vision-doc min-h-[60vh] focus:outline-none", "aria-label": "Your vision" } },
    onUpdate: ({ editor }) => {
      setState(null);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => save(editor.getHTML()), 900);
    },
    onBlur: ({ editor }) => {
      if (timer.current) clearTimeout(timer.current);
      save(editor.getHTML());
    },
  });

  // Save anything pending if you leave the page.
  useEffect(() => {
    const flush = () => editor && save(editor.getHTML());
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  });

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-1 flex items-center gap-1 bg-bg/95 px-1 py-2 backdrop-blur">
        <Toolbar editor={editor} />
        <span aria-live="polite" className="ml-auto text-xs text-muted">
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : ""}
        </span>
      </div>
      {error && <p role="alert" className="mb-2 text-sm text-danger">{error}</p>}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  const btn = (on: boolean) => `rounded-full px-2.5 py-1 text-sm ${on ? "bg-ink text-bg" : "text-muted hover:text-ink"}`;
  return (
    <div className="flex items-center gap-0.5" role="toolbar" aria-label="Formatting">
      <button type="button" className={btn(editor.isActive("paragraph"))} onClick={() => editor.chain().focus().setParagraph().run()} aria-label="Text">
        Text
      </button>
      <button type="button" className={btn(editor.isActive("heading", { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} aria-label="Title">
        Title
      </button>
      <button type="button" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="Heading">
        Heading
      </button>
      <span aria-hidden="true" className="mx-1 h-4 border-l border-line" />
      <button type="button" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bullet list">
        •
      </button>
      <button type="button" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Numbered list">
        1.
      </button>
      <button type="button" className={`${btn(editor.isActive("bold"))} font-semibold`} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold">
        B
      </button>
    </div>
  );
}
