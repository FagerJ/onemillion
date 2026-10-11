# One Million Beers — news

The crew's news site, at **https://news.onemillion.fager.tech**: release notes for the
app, and the questions the crew is deciding together. Astro, plain static pages, the
app's design language.

A post is one Markdown file:

- release notes → `src/content/notes/YYYY-MM-DD-name.md`
- questions → `src/content/questions/YYYY-MM-DD-name.md`

Front matter, voice and commands: [CLAUDE.md](CLAUDE.md).

```bash
npm install
npm run dev      # http://localhost:4321
npm run build
```
