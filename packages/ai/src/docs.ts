// Docs search for agents: clarusjs.com's llms-full.txt (every page's text), split into sections and ranked by the
// query's words. Fetched once a day and cached, so it works offline after the first time.
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const DOCS_URL = 'https://clarusjs.com/llms-full.txt'
const DAY = 24 * 60 * 60 * 1000

type Section = { url: string; heading: string; text: string }

/** A heading's anchor, as the docs site makes it (@clarusjs/content's slugify). */
const slugify = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-') || 'section'

/** Each page's sections: its top (before the first ##) and each ## or ### heading, with its URL and #anchor. */
export function sections(full: string): Section[] {
  const out: Section[] = []
  for (const page of full.split(/\n---\n\nSource: /).slice(1)) {
    const url = page.slice(0, page.indexOf('\n')).trim()
    const body = page.slice(page.indexOf('\n') + 1)
    // Headings inside code blocks aren't headings: split only outside ``` fences.
    let fence = false
    // The page's top section is headed by its title (the # line).
    let current: Section = { url, heading: /^# (.+)/m.exec(body)?.[1] ?? '', text: '' }
    for (const line of body.split('\n')) {
      if (/^\s*```/.test(line)) fence = !fence
      const h = !fence && /^#{2,3} (.+)/.exec(line)
      if (h) {
        if (current.text.trim()) out.push(current)
        current = { url: `${url}#${slugify(h[1]!)}`, heading: h[1]!, text: '' }
      }
      current.text += line + '\n'
    }
    if (current.text.trim()) out.push(current)
  }
  return out
}

// ponytail: keyword ranking (damped counts, heading matches); embeddings if agents miss sections it should find.
/** The sections that best match `query`: by how many of its words they contain, then how often (headings count more). */
export function search(full: string, query: string, limit = 5): Section[] {
  const words = [...new Set(query.toLowerCase().match(/[\w$@-]{2,}/g) ?? [])]
  const scored = sections(full).map((s) => {
    const text = s.text.toLowerCase()
    const heading = s.heading.toLowerCase()
    let hits = 0
    let score = 0
    for (const w of words) {
      const n = text.split(w).length - 1
      if (n) hits++
      // Damped: a long page that repeats a word doesn't outrank the section about it; a heading match counts most.
      score += Math.log2(1 + n) + (heading.includes(w) ? 4 : 0)
    }
    return { s, rank: hits * 1000 + score }
  })
  return scored.filter((x) => x.rank > 0).sort((a, b) => b.rank - a.rank).slice(0, limit).map((x) => x.s)
}

/** llms-full.txt: from the cache when it is less than a day old, else fetched (and the stale copy if that fails). */
export async function loadDocs(fetchImpl: typeof fetch, cacheDir: string): Promise<string> {
  const file = resolve(cacheDir, 'llms-full.txt')
  let cached: string | undefined
  try {
    cached = readFileSync(file, 'utf8')
    if (Date.now() - statSync(file).mtimeMs < DAY) return cached
  } catch {}
  try {
    const res = await fetchImpl(DOCS_URL)
    if (!res.ok) throw new Error(`${DOCS_URL}: ${res.status}`)
    const text = await res.text()
    // A cache that can't be written (read-only home, a file in the way) only costs the next fetch.
    try {
      mkdirSync(cacheDir, { recursive: true })
      writeFileSync(file, text)
    } catch {}
    return text
  } catch (err) {
    if (cached) return cached
    throw err
  }
}
