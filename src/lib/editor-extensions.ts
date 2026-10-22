import { Underline } from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";

// Markdown has no underline syntax; <u> renders on GitHub and round-trips through import.
const PortableUnderline = Underline.extend({
  renderMarkdown: (node, helpers) => `<u>${helpers.renderChildren(node)}</u>`,
});

// Shared by the browser editor and server-side import, export and validation so all accept the same schema.
export const extensions = [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, underline: false }), PortableUnderline];
