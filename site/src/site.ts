import type { CollectionEntry } from 'astro:content'

export const APP_URL = 'https://onemillion.fager.tech'
export const REPO_URL = 'https://github.com/FagerJ/onemillion'

/** 10 October 2026 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Newest first. */
export function byDate<T extends CollectionEntry<'notes' | 'questions'>>(entries: T[]): T[] {
  return [...entries].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
}
