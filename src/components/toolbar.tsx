"use client";

import { useEditorState, type Editor } from "@tiptap/react";

const BLOCKS = [
  { value: "p", label: "Normal text" },
  { value: "1", label: "Heading 1" },
  { value: "2", label: "Heading 2" },
  { value: "3", label: "Heading 3" },
] as const;

export function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: ([1, 2, 3] as const).find((level) => e.isActive("heading", { level }))?.toString() ?? "p",
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  const buttons = [
    { label: "Bold (Cmd+B)", text: "B", className: "font-bold", active: state.bold, run: () => chain().toggleBold().run() },
    { label: "Italic (Cmd+I)", text: "I", className: "italic font-serif", active: state.italic, run: () => chain().toggleItalic().run() },
    { label: "Underline (Cmd+U)", text: "U", className: "underline", active: state.underline, run: () => chain().toggleUnderline().run() },
    { label: "Bulleted list", text: "• List", active: state.bulletList, run: () => chain().toggleBulletList().run() },
    { label: "Numbered list", text: "1. List", active: state.orderedList, run: () => chain().toggleOrderedList().run() },
    { label: "Undo (Cmd+Z)", text: "↶", disabled: !state.canUndo, run: () => chain().undo().run() },
    { label: "Redo (Cmd+Shift+Z)", text: "↷", disabled: !state.canRedo, run: () => chain().redo().run() },
  ];

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1">
      <select
        aria-label="Text style"
        value={state.block}
        onChange={(event) => {
          const level = Number(event.target.value) as 1 | 2 | 3;
          if (level) chain().setHeading({ level }).run();
          else chain().setParagraph().run();
        }}
        className="mr-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
      >
        {BLOCKS.map((block) => (
          <option key={block.value} value={block.value}>
            {block.label}
          </option>
        ))}
      </select>
      {buttons.map((button) => (
        <button
          key={button.label}
          type="button"
          title={button.label}
          aria-label={button.label}
          aria-pressed={button.active}
          disabled={button.disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={button.run}
          className={`min-w-8 rounded-md px-2 py-1 text-sm hover:bg-slate-100 disabled:opacity-40 aria-pressed:bg-blue-100 aria-pressed:text-blue-800 ${button.className ?? ""}`}
        >
          {button.text}
        </button>
      ))}
    </div>
  );
}
