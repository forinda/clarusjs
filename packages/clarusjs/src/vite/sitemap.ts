// sitemap.xml for the built static pages, with each page's last change from git (one `git log` for all of them).
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Newest commit time (unix seconds) of every file under `dir` that git knows, by absolute path. One `git log` lists
 * commits newest first with the files each touched, so a file's first appearance is its last change. Not a git
 * repository (or no git): an empty map.
 */
export function gitDates(root: string, dir: string): Map<string, number> {
  const dates = new Map<string, number>()
  let log: string
  try {
    log = execFileSync('git', ['log', '--format=%x00%ct', '--name-only', '--relative', '--', dir], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 })
  } catch {
    return dates
  }
  for (const commit of log.split('\0').slice(1)) {
    const [time, ...files] = commit.trim().split('\n')
    for (const file of files) {
      const path = resolve(root, file.trim())
      if (file.trim() && !dates.has(path)) dates.set(path, Number(time))
    }
  }
  return dates
}

/** The sitemap: one <url> per page, under the site URL and base; lastmod (unix seconds) as a date when known. */
export function sitemapXml(siteUrl: string, base: string, pages: { path: string; lastmod: number | undefined }[]): string {
  const root = new URL(base, siteUrl.replace(/\/?$/, '/'))
  const urls = pages.map(({ path, lastmod }) => {
    const loc = new URL(`./${path.slice(1)}`, root).href
    const date = lastmod === undefined ? '' : `<lastmod>${new Date(lastmod * 1000).toISOString().slice(0, 10)}</lastmod>`
    return `<url><loc>${xml(loc)}</loc>${date}</url>\n`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('')}</urlset>\n`
}
