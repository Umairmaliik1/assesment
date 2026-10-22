// Builds a Content-Disposition value with an ASCII fallback and the exact UTF-8 title.
export function attachmentHeader(title: string, extension: string): string {
  const base = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim() || "document";
  const ascii = base.replace(/[^\x20-\x7e]/g, "_");
  const encoded = encodeURIComponent(`${base}.${extension}`).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}.${extension}"; filename*=UTF-8''${encoded}`;
}
