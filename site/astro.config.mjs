// @ts-check
import { defineConfig } from 'astro/config'

// The crew's news site: release notes and questions, each a Markdown file in
// src/content/. Builds to plain HTML with no client-side JavaScript.
// https://astro.build/config
export default defineConfig({
  site: 'https://news.onemillion.fager.tech',
  server: { port: 4321 },
})
