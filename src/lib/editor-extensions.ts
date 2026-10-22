import StarterKit from "@tiptap/starter-kit";

// Shared by the browser editor and server-side import/validation so both accept the same schema.
export const extensions = [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false })];
