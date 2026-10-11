# The news site — working notes

`site/` is the crew's news site at **https://news.onemillion.fager.tech**: release notes and
questions for the crew. Astro 7, static HTML, no client-side JavaScript. Vercel project
`onemillion-news` builds it from this folder on every push to `main` (D46).

## Posting

Everything is a Markdown file; its name becomes its address.

- **Release note** → `src/content/notes/YYYY-MM-DD-short-name.md`
- **Question** → `src/content/questions/YYYY-MM-DD-short-name.md`

Front matter (checked by `src/content.config.ts` — a build fails on a missing field):

```yaml
---
title: Parties are crews now
date: 2026-10-10
summary: One or two sentences, shown on the home page and in the list.
# questions only:
status: open            # or decided — then write the answer into the post
answer:                 # optional; without it the page says "tell the crew"
  label: Vote in the shared doc
  url: https://…
---
```

Write for the crew, not for developers: what changed for them, in the app's voice (a
football commentator at the pub — loud, affectionate, never violent). No ADR numbers, no
file names, no "party" (D45). Numbers in European format: `1.000.000`.

## Running it

```bash
npm --prefix site install
npm --prefix site run dev     # http://localhost:4321
npm --prefix site run build   # what Vercel runs
```

Design follows the app (D42): tokens in `src/styles/global.css` match `app/src/index.css`.
