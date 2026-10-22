// Vercel rejects request bodies above 4.5 MB, so stay safely under it.
export const IMPORT_MAX_BYTES = 4 * 1024 * 1024;
export const IMPORT_EXTENSIONS = [".txt", ".md", ".docx"] as const;
