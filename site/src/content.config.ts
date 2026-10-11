import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

// Every post is one Markdown file. Its name becomes its address:
// src/content/notes/2026-10-10-crews.md → /notes/2026-10-10-crews/

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    // one or two sentences: shown on the home page and in the list
    summary: z.string(),
  }),
})

const questions = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/questions' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    // decided questions stay up, marked, with the answer written into the post
    status: z.enum(['open', 'decided']).default('open'),
    // where people answer; without it the page says to tell the crew
    answer: z.object({ label: z.string(), url: z.url() }).optional(),
  }),
})

export const collections = { notes, questions }
