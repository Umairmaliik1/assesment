# Architecture note

## Shape of the system

One Next.js 15 app deployed on Vercel. Pages are React Server Components that read data directly on the server. The browser changes data through a small JSON API (`src/app/api/**`). Postgres (Neon on Vercel, embedded PGlite locally and in tests) is the only stateful piece.

```
Browser (Tiptap editor, dashboard)
   │  fetch JSON / multipart
   ▼
Route handlers  ── requireUser (signed cookie) ── zod validation
   │
   ▼
src/lib/documents.ts  ── authorize(doc, user, action) ── can(role, action)
   │
   ▼
Drizzle ORM ── Postgres: users, documents, document_shares
```

## Key decisions

**One framework, one deploy.** Next.js route handlers give a real API boundary without a second service to host. Vercel was the only hosting available, and Vercel's filesystem is ephemeral, so SQLite or file storage would lose data. Neon Postgres is free, one click from the Vercel dashboard, and persists.

**Rich text stored as Tiptap JSON.** Content is stored as the editor's own JSON document in a `jsonb` column, so formatting round-trips exactly, with no HTML parsing on load. Every save is checked on the server against the same ProseMirror schema the editor uses, and an invalid node returns 400. File import also converts through that schema, which drops scripts, raw HTML and anything the editor cannot represent.

**Access control in one place.** `can(role, action)` is a pure table of permissions: owner has everything, editor can view and edit, viewer can only view. Every data function goes through `authorize()`, which loads the document and the caller's role in one query. Users with no access get 404, not 403, so document ids cannot be probed. Only the owner can rename, share or delete. Editors edit content only, which keeps ownership clear.

**Optimistic concurrency instead of real-time collaboration.** Each document has a `version`. A content save is `UPDATE ... WHERE id = ? AND version = ?`. If someone else saved first, nothing is updated and the API returns 409 (or 404 if the document was deleted in the meantime). The editor then shows a banner where the user loads the latest version or deliberately overwrites. This prevents silent lost updates with one indexed update and no transactions, and works with Neon's HTTP driver on serverless functions. Title changes do not bump the version, so renaming never conflicts with an in-flight content save.

**Autosave that does not lose the last keystrokes.** Saves are debounced (800 ms) and serialized, never two at once. Edits made during a save trigger a follow-up save. Network and 5xx errors retry after 5 s while the document is open. Every way out of the editor sends pending edits first: in-app links and Sign out wait for the save, browser Back and Forward save on unmount, and leaving the site sends a `keepalive` request (the browser's "leave site?" prompt remains the safety net for documents over the 64 KB keepalive limit). If a save cannot succeed (for example access was revoked), leaving asks for confirmation instead of silently blocking. Pages restored from the browser history refresh themselves, so a stale copy never triggers a false conflict, and "Load their version" remounts the editor, so undo cannot bring back the overwritten text.

**Export rendered on the server.** `GET /api/documents/:id/export?format=pdf|md` uses the same `view` permission as reading. Markdown comes from Tiptap's own serializer, configured with the shared editor schema; underline is written as `<u>` because Markdown has no underline syntax, which keeps exports portable and lets them re-import losslessly. PDF is laid out by a small renderer on top of `pdf-lib` (pure JavaScript, so it runs in a normal Vercel function): headings, marks, nested lists, quotes, code and page numbers, with real selectable text. Fonts are Noto Sans, so accented, Greek and Cyrillic text renders. `pdf-lib`'s built-in font subsetting dropped glyphs from these fonts, so each font is first trimmed to the document's characters with HarfBuzz (`subset-font`), keeping a typical PDF under 100 KB.

**Mocked auth with real enforcement.** The assignment allows simulated users, so login is a picker over three seeded accounts. The session is still an HS256-signed JWT in an httpOnly, SameSite=Lax cookie, and every API call resolves the user on the server. Replacing the picker with real authentication would not touch the access layer.

**File import as "new document".** `.txt`, `.md` (via `marked`) and `.docx` (via `mammoth`) are converted to HTML, then into the editor schema on the server. The upload limit is 4 MB because Vercel rejects function request bodies above 4.5 MB. It is checked in the browser for fast feedback and enforced on the server. The converted document must also pass the same validation as a normal save, so an import can never create a document that is too large to save.

**Migrations at build time.** The build applies pending migrations through Neon's WebSocket driver, so each migration runs in a transaction (the HTTP driver used at runtime cannot do transactions, and a half-applied migration would break every later build).

**Zero-setup local runs and tests.** Without `DATABASE_URL`, the app uses PGlite (Postgres compiled to WebAssembly), so reviewers can run `pnpm install && pnpm dev` with nothing else installed. Tests use an in-memory PGlite per test file, running the same migrations as production. PGlite is excluded from the deployed function bundle.

## What I deliberately did not build

- **Real-time co-editing** (CRDT or OT, live cursors). Vercel functions cannot hold WebSockets, so this would need a third-party realtime service. It was the highest-risk item for the timebox. The conflict guard covers the data-loss risk instead.
- **Real sign-up and passwords, share by email invite, public links.** Seeded users exercise the same access logic.
- **Comments, suggestions, version history, `.docx` export, images and tables, attachments.**

## What I would build next (2 to 4 hours)

1. Version history: keep the previous content on each save (cheap with the existing version column) and let owners restore it.
2. Live presence and update notifications by polling `version` every few seconds, so editors learn about changes before they conflict.
3. Export to `.docx`, and emoji in PDFs by adding an emoji font.
4. Run the browser walkthrough (`pnpm e2e`) and the test suite in CI on every pull request.
5. Rate limiting on the API and audit entries for share changes.
