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

## Polls

A question can carry a poll (D47): votes go to Supabase through `cast_vote()` and
`poll_results()`, the only two things a signed-out visitor may call. A new poll is:

1. a migration inserting a row into `polls` — its `id` and the option keys it accepts;
2. a question post whose front matter names the same id and keys, with their labels:

```yaml
poll:
  id: address
  options:
    - key: ombpls-beer
      label: ombpls.beer
      hint: The app at ombpls.beer, the news at news.ombpls.beer
```

The database refuses a key it doesn't know. To close a poll, set `is_open = false` on its
row and mark the post `status: decided` (DEPLOY.md has the SQL).

The site reads `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` at build time —
Vercel project variables in production; locally, `site/.env.local` pointing at the local
stack (the app's `app/.env.local` with `VITE_` swapped for `PUBLIC_`). A production build
without them fails rather than shipping a poll that can't vote.

## Running it

```bash
npm --prefix site install
npm --prefix site run dev     # http://localhost:4321
npm --prefix site run build   # what Vercel runs
```

Design follows the app (D42): tokens in `src/styles/global.css` match `app/src/index.css`.
