# Submission

## Links

- **Live app:** <add the Vercel URL>
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
| AI workflow note | `AI_WORKFLOW.md` |
| Walkthrough video link | `VIDEO_URL.txt` |
| Screenshots | `docs/screenshots/` |
| Automated tests | `src/test/api.test.ts`, `src/lib/access.test.ts`, `src/lib/import.test.ts` (`pnpm test`) |
| Browser walkthrough script | `e2e/flow.mjs` (`pnpm e2e` against a running app) |
| Environment template | `.env.example` |

## Status

**Working end to end**

- Create, rename, edit, autosave, reopen and delete documents
- Bold, italic, underline, headings 1 to 3, bulleted and numbered lists, undo and redo
- Import `.txt`, `.md` and `.docx` (up to 4 MB) as new editable documents
- Sharing with Viewer and Editor roles: change and revoke access, owned and shared lists, server-side enforcement
- Persistence in Postgres, with formatting preserved exactly
- Conflict detection when two people edit the same document

**Intentionally not built**

Real-time co-editing, real sign-up and passwords, comments, version history, export, images and tables. The reasoning is in `ARCHITECTURE.md`.

**Next with another 2 to 4 hours**

Version history with restore, change notifications through version polling, export to `.docx` and Markdown, and the browser walkthrough running in CI.
