// sitemap.xml for the built static pages, with each page's last change from git (one `git log` for all of them).
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Newest commit time (unix seconds) of every file under `dir` that git knows, by absolute path. One `git log` lists
 * commits newest first with the files each touched, so a file's first appearance is its last change. Not a git
 * repository (or no git): an empty map.
 * @internal clarusjs's own build and server code call this; apps don't.
 */
export function gitDates(root: string, dir: string): Map<string, number> {
  const dates = new Map<string, number>()
  let log: string
  try {
    // -z: file names exactly as they are (git quotes non-ASCII names otherwise), each ended by NUL; \x01 starts a commit.
    log = execFileSync('git', ['log', '--format=%x01%ct', '-z', '--name-only', '--relative', '--', dir], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 })
  } catch {
    return dates
  }
  for (const commit of log.split('\x01').slice(1)) {
    const [time, ...files] = commit.split('\0')
    for (const file of files.map((f) => f.replace(/^\n/, '')).filter(Boolean)) {
      const path = resolve(root, file)
      if (!dates.has(path)) dates.set(path, Number(time))
    }
  }
  return dates
}

/**
 * The sitemap: one <url> per page, under the site URL and base; lastmod (unix seconds) as a date when known; images
 * (src as written, resolved against the page's URL) with Google's image extension.
 */
export function sitemapXml(siteUrl: string, base: string, pages: { path: string; lastmod: number | undefined; images?: string[] }[]): string {
  // An absolute base (a CDN) counts by its path: the pages are on the site.
  const root = new URL(/^https?:\/\//i.test(base) ? new URL(base).pathname : base, siteUrl.replace(/\/?$/, '/'))
  const urls = pages.map(({ path, lastmod, images = [] }) => {
    const loc = new URL(`./${path.slice(1)}`, root).href
    const date = lastmod === undefined ? '' : `<lastmod>${new Date(lastmod * 1000).toISOString().slice(0, 10)}</lastmod>`
    const pics = images.map((src) => `<image:image><image:loc>${xml(new URL(src, loc).href)}</image:loc></image:image>`).join('')
    return `<url><loc>${xml(loc)}</loc>${date}${pics}</url>\n`
  })
  const ns = pages.some((p) => p.images?.length) ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ''
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${ns}>\n${urls.join('')}</urlset>\n`
}
