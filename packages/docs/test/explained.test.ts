// "This site, explained": the route manifest as stats, and one row per route for the table island.
import { expect, test } from 'vitest'
import { explain } from '../src/explained.ts'

const route = (initialGzip: number, gzip: number, islands: { component: string; count: number; attach: string }[] = []) => ({ islands, js: { initialGzip, gzip } })
const manifest = {
  routes: {
    '/': route(2048, 4096, [{ component: 'counter', count: 1, attach: 'load' }]),
    '/guide/a': route(0, 0),
    '/guide/b': route(1024, 3072, [{ component: 'copy', count: 3, attach: 'interaction' }]),
    '/reference/x': route(0, 0),
    '/repl': route(10240, 20480, [{ component: 'repl', count: 1, attach: 'load' }]),
  },
}

test('stats: pages, pages that ship no JavaScript on load, island pages, and the heaviest load', () => {
  expect(explain(manifest).stats).toEqual({ pages: 5, noJs: 2, withIslands: 3, heaviest: '10.0 KB' })
})

test('no manifest (outside a build): empty', () => {
  expect(explain(null)).toEqual({ stats: { pages: 0, noJs: 0, withIslands: 0, heaviest: '0.0 KB' }, rows: [] })
})

test('rows for the table island: route, section, islands (text and count), bytes on load and in all', () => {
  expect(explain(manifest).rows.find((r) => r.route === '/guide/b')).toEqual({ route: '/guide/b', section: 'Guide', islands: 'copy ×3 (interaction)', islandCount: 3, load: 1024, all: 3072 })
  expect(explain(manifest).rows.map((r) => r.route)).toEqual(['/', '/guide/a', '/guide/b', '/reference/x', '/repl'])
})
