# Submission

## Links

- **Live app:** https://inkwellassesment.vercel.app
- **Source:** https://github.com/Umairmaliik1/assesment (also included in this folder)
- **Walkthrough video:** see `VIDEO_URL.txt`

## Test accounts

No passwords. On the sign in page, pick **Alice Johnson**, **Bob Smith** or **Carol Diaz**. Use a second browser or a private window to be signed in as two users at once.

## What is included

| Item | Location |
| --- | --- |
| Source code | `src/`, `scripts/`, `drizzle/`, `e2e/`, config files at the root |
| Setup and run instructions | `README.md` |
| Architecture note | `ARCHITECTURE.md` |
| Workflow note | `AI_WORKFLOW.md` |
| Walkthrough video link | `VIDEO_URL.txt` |
| Screenshots | `docs/screenshots/` (editor, export menu, sharing, shared dashboard, conflict, mobile) |
| Automated tests | `src/test/api.test.ts`, `src/lib/access.test.ts`, `src/lib/import.test.ts`, `src/lib/export/export.test.ts` (`pnpm test`, 38 tests) |
| Browser walkthrough script | `e2e/flow.mjs` (`pnpm e2e` against a running app) |
| Environment template | `.env.example` |

## Status

**Working end to end**

- Create, rename, edit, autosave, reopen and delete documents
- Bold, italic, underline, headings 1 to 3, bulleted and numbered lists, undo and redo
- Import `.txt`, `.md` and `.docx` (up to 4 MB) as new editable documents
- Export any document you can view as PDF or Markdown
- Sharing with Viewer and Editor roles: change and revoke access, owned and shared lists, server-side enforcement
- Persistence in Postgres, with formatting preserved exactly
- Conflict detection when two people edit the same document

**Intentionally not built**

Real-time co-editing, real sign-up and passwords, comments, version history, `.docx` export, images and tables. Emoji are omitted from PDF exports (the embedded font has no emoji glyphs). The reasoning is in `ARCHITECTURE.md`.

**Next with another 2 to 4 hours**

Version history with restore, change notifications through version polling, `.docx` export, and the browser walkthrough running in CI.
