# One Million Beers — the app

React + TypeScript on Vite, Tailwind v4 and shadcn/ui (Radix). Talks to Supabase directly:
reads under RLS, writes as [D39](../docs/DECISIONS.md) allows. Why this stack and what the
design language is: [D42](../docs/DECISIONS.md).

```bash
npm install
npm run dev      # http://localhost:5173 — needs the local Supabase stack and .env.local
npm run build    # type-check + production build
```

Setup, demo logins and testing on a phone: [docs/LOCAL-SETUP.md](../docs/LOCAL-SETUP.md) § 4½.

```
src/
  routes/            one file per screen (Welcome, setup/, Home, Night, Nights, PartyPage, Me)
  components/brand/  the design language: Cap, PintGauge, Flaps, LiveBadge, CountUp
  components/home/   the dashboard's sections
  components/ui/     shadcn/ui, restyled to the brand
  data/              every query and mutation (queries.ts) and Realtime (realtime.ts)
  i18n/              all user-facing text (en.ts), typed keys
  lib/               supabase client, generated DB types, formatting, milestones
```
