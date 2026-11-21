// Search, shared by the build (which writes the index) and the browser (which queries it). Plain JavaScript: the
// build side runs from vite.config. Types are the JSDoc here; search.d.ts is generated from it (pnpm types; typecheck and prepack run it).
//
// The index is many small JSON files, never one big one: `t-<xx>.json` maps the words starting with xx to
// [section, weight, section, weight…]; `s-<n>.json` holds sections n*64 to n*64+63 ({ u: url, p: page, h: heading,
// t: text }). A query loads one term file per word and the section files of its best results.

/**
 * A search result: a page section (url with #heading, page title, heading, text).
 * @typedef {{ u: string; p: string; h: string; t: string }} Section
 */

/** Sections per `s-<n>.json` file. */
export const CHUNK = 64

/** @param {string} text @returns {string[]} lowercase words of two or more letters, accents folded */
export function tokens(text) {
  return (text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 1)
}

/** @param {string} word */
export const termFile = (word) => `t-${word.slice(0, 2)}.json`

/**
 * Sections matching every word of the query (the last one as a prefix, so results come while typing), best first:
 * a word in a heading counts 10, each use in the text 1 (at most 3).
 * @param {string} query
 * @param {(file: string) => Promise<any>} load a file of the index, parsed
 * @param {number} [limit]
 * @returns {Promise<Section[]>}
 */
export async function search(query, load, limit = 10) {
  const words = tokens(query)
  if (!words.length) return []
  const shards = await Promise.all(words.map((w) => load(termFile(w)).catch(() => ({}))))
  /** @type {Map<number, number> | undefined} */
  let scores
  for (const [i, word] of words.entries()) {
    const last = i === words.length - 1
    /** @type {Map<number, number>} */
    const found = new Map()
    for (const [term, postings] of Object.entries(/** @type {Record<string, number[]>} */ (shards[i]))) {
      if (term !== word && !(last && term.startsWith(word))) continue
      for (let j = 0; j < postings.length; j += 2) found.set(postings[j], (found.get(postings[j]) ?? 0) + postings[j + 1])
    }
    scores = scores ? new Map([...scores].filter(([id]) => found.has(id)).map(([id, s]) => [id, s + /** @type {number} */ (found.get(id))])) : found
  }
  const best = [...(scores ?? [])].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id)
  /** @type {Map<number, Section[]>} */
  const chunks = new Map()
  await Promise.all([...new Set(best.map((id) => Math.floor(id / CHUNK)))].map(async (n) => chunks.set(n, await load(`s-${n}.json`))))
  return best.map((id) => /** @type {Section[]} */ (chunks.get(Math.floor(id / CHUNK)))[id % CHUNK])
}
