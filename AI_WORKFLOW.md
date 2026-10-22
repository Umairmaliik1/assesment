# AI workflow note

## Tools used

- **Claude Code** (Anthropic, Claude Opus model) in the terminal: requirements breakdown, scaffolding, implementation, tests, and driving a headless Chrome to check the UI.
- No other AI tools.

## How I used it

I treated the AI as a fast pair programmer, not an autopilot. Before any code was written, I had it turn the brief into a list of decisions and answered each one myself: stack, database, editor library, login model, upload behaviour, collaboration depth, permission model, and test scope. I then approved a written plan before building started.

## Where AI materially sped things up

- Scaffolding the Next.js app, the Drizzle schema and migration, and the route handlers.
- Tiptap integration: toolbar state, shared schema between browser and server, server-side HTML to JSON conversion for imports.
- Writing the test suite, including a hand-built minimal `.docx` fixture so the Word import is tested without binary files in the repo.
- Writing a browser script (`e2e/flow.mjs`) that runs the whole two-user flow (format, share, view-only, conflict, import, revoke, delete) in about 20 seconds, so every change could be re-checked quickly.

## What I changed or rejected

- **Storage:** SQLite or file storage was rejected because Vercel's filesystem does not persist. I chose Neon Postgres from the Vercel dashboard.
- **Upload limit:** the plan said 5 MB. That was reduced to 4 MB after checking that Vercel rejects request bodies above 4.5 MB.
- **A speculative fix was reverted.** The local embedded database got corrupted once during testing. The first suggested fix (closing it on shutdown signals) was A/B tested, did not change the outcome, and was removed instead of shipped. The real cause is that PGlite is single-process, and it is documented in the README.
- **Bugs found by review and testing, then fixed:**
  - Pressing Escape in the title field committed the edited title instead of cancelling.
  - On phone-width screens the document title collapsed to zero width and buttons overlapped. This was found by measuring the layout at 390 px.
  - Database errors were being reported to users as "logged out". Only token errors are treated that way now.
- **An independent AI review pass** of the finished code found no access-control holes but listed ten possible defects. I treated them as hypotheses and checked each before changing anything: browser reproductions for the UI issues, and the library source for the migration issue. Nine were real and fixed:
  - Edits typed just before browser Back or Sign out were lost.
  - A page restored by Back showed stale content and then a false conflict.
  - A large import created a document that could never be saved.
  - After a failed save, links stopped working.
  - Retries kept running after leaving the page.
  - Undo after "Load their version" overwrote the other person's text.
  - Fast renames could land in the wrong order.
  - Build-time migrations were not transactional.
  - A document deleted during a save was reported as a conflict (fixed from code reading, since the race cannot be timed reliably).
  - One was rejected after testing: the claimed import bundling problem does not occur in the production build.
  - Fixing Back exposed one more gap the review missed: leaving the site entirely skipped the save. It now sends a `keepalive` request.
- **Export feature, checked by looking at the output:** the first PDFs passed every automated test and extracted the right text, but rendering one to an image showed most letters missing. An A/B test isolated it to `pdf-lib`'s font subsetting, so fonts are now subset with HarfBuzz first. The same visual check caught code blocks being merged onto one line, and a phone-width measurement caught the new Export button squeezing the title to 33 px.
- **A weak test was strengthened.** Breaking the "must be a document root" validation did not fail any test, so I added a case that does.

## How I verified correctness and quality

- **Tests can fail.** I deliberately broke each rule the tests guard and confirmed a test failed each time, then restored the code: an editor gaining owner rights, removing the version check, giving strangers access, removing HTML escaping, disabling content validation, removing the import size check, writing underline in a non-standard Markdown form, and skipping export format validation.
- **End-to-end in a real browser.** A headless Chrome run with two users (`pnpm e2e`) checks 30 behaviours, including export downloads, formatting persisting after reload, viewer restrictions, the conflict banner, import, revocation and deletion. The navigation save guard was A/B tested: without it, the edits typed just before leaving a page were lost.
- **Deployment risk.** I ran a clean install and build with the pnpm version Vercel uses, confirmed a missing `DATABASE_URL` on Vercel fails with a clear error, and confirmed the embedded database is not shipped in serverless bundles.
- **Gates on every change:** typecheck, lint, 38 tests and a production build.
