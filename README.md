# Ajaia Docs

A lightweight collaborative document editor: create and format documents in the browser, import files, and share them with other users as viewers or editors.

- **Live app:** _add the Vercel URL here after deploying_
- **Stack:** Next.js 15 (App Router, TypeScript), Tiptap editor, Postgres via Drizzle ORM, Tailwind CSS
- **More detail:** [ARCHITECTURE.md](ARCHITECTURE.md), [AI_WORKFLOW.md](AI_WORKFLOW.md), [SUBMISSION.md](SUBMISSION.md)

## Demo accounts

Sign in is a demo account picker (no passwords). Use two browsers, or a normal and a private window, to act as two users at once.

| User | Email |
| --- | --- |
| Alice Johnson | alice@ajaia.test |
| Bob Smith | bob@ajaia.test |
| Carol Diaz | carol@ajaia.test |

Suggested review flow: sign in as Alice, create a document and format it, share it with Bob as **Viewer**, then sign in as Bob in a second window and open it from **Shared with me**. Switch Bob to **Editor** and edit from both windows to see the conflict guard.

## Features

- **Documents:** create, rename (click the title), edit, delete. Autosaves about a second after you stop typing, with a visible save status.
- **Formatting:** bold, italic, underline, headings 1 to 3, bulleted and numbered lists, undo and redo. Markdown shortcuts such as `# ` and `- ` also work.
- **File import:** `.txt`, `.md` and `.docx` files up to **4 MB** become a new editable document. Headings, lists and bold or italic text are kept. Images, tables and other unsupported content are dropped. Other file types are rejected with a clear message.
- **Sharing:** the owner grants **Viewer** (read only) or **Editor** (can edit content) access, and can change or remove it. Only the owner can rename, share or delete. The dashboard separates **My documents** from **Shared with me**, with role badges and owner names.
- **Conflict guard:** if someone else saved since you loaded the document, your save is rejected instead of silently overwriting theirs. You choose **Load their version** or **Keep mine and overwrite**.

## Run locally

Requirements: Node.js 22 or newer, and pnpm (`npm i -g pnpm`).

```bash
pnpm install
pnpm dev          # migrates and seeds, then starts http://localhost:3000
```

No database setup is needed: without `DATABASE_URL` the app uses an embedded Postgres (PGlite) stored in `.data/`. To run against Neon instead, copy `.env.example` to `.env.local` and set `DATABASE_URL` to a Neon connection string. The app uses Neon's serverless drivers, so other Postgres hosts would need a driver swap in `src/db/index.ts`.

The embedded database is single-process: stop the dev server before running `pnpm build` or `pnpm db:setup`. To reset local data, stop the server and delete `.data/`.

### Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Prepare the database and start the dev server |
| `pnpm build` / `pnpm start` | Prepare the database, production build, and serve it |
| `pnpm test` | Run the test suite (Vitest, in-memory Postgres, no setup needed) |
| `pnpm e2e` | Two-user browser walkthrough against a running app (needs Google Chrome; set `BASE_URL`, default `http://localhost:3000`) |
| `pnpm lint` / `pnpm typecheck` | ESLint and TypeScript checks |
| `pnpm db:setup` | Apply migrations and seed the demo users (idempotent) |
| `pnpm db:generate` | Generate a new migration after changing `src/db/schema.ts` |

## Deploy to Vercel (free tier)

1. Import this GitHub repository in Vercel. The Next.js preset needs no changes.
2. In the project, open **Storage**, create a **Neon** Postgres database (free plan) and connect it to the project. This injects `DATABASE_URL`.
3. In **Settings > Environment Variables**, add `SESSION_SECRET` with at least 32 random characters (`openssl rand -base64 32`).
4. Deploy, or redeploy if the first build ran before the variables existed. The build applies migrations (each in a transaction) and seeds the demo users before `next build`. Preview deployments use the same database unless you give them their own Neon branch.

## Tests

`pnpm test` runs 31 tests:

- `src/test/api.test.ts` calls the real route handlers against a migrated in-memory Postgres: sessions, owned and shared listings, every role's allowed and denied actions, revocation, persistence, the 409 conflict path, input validation, and import through the API.
- `src/lib/access.test.ts` checks the full role and permission matrix.
- `src/lib/import.test.ts` checks Markdown, plain text and `.docx` conversion, removal of scripts and raw HTML, and rejection of unsupported, corrupt and oversized files, including files that would convert into a document too large to save.

## Project layout

```
drizzle/                 SQL migrations
scripts/db-setup.ts      migrate and seed
src/app/                 pages and API route handlers (src/app/api/**)
src/components/          editor, toolbar, autosave hook, share dialog, dashboard
src/db/                  schema, connection (Neon or embedded PGlite), seed users
src/lib/                 access rules, auth, data access, import, validation
src/test/                API tests and test database setup
```
