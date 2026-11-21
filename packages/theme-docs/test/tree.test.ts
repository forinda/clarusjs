// The sidebar from the files under src/pages: themeDocs() reads them (readPages), pagesNav merges them with the config.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { beforeAll, expect, test } from 'vitest'
import { pager, pagesNav, type Section } from '../src/nav.ts'
import { readPages, themeDocs } from '../src/vite.js'

let dir = ''

beforeAll(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'theme-tree-'))
  const w = (path: string, text: string) => { mkdirSync(resolve(dir, path, '..'), { recursive: true }); writeFileSync(resolve(dir, path), text) }
  w('guide/start.md', '---\ntitle: "Getting started"\ngroup: Basics\norder: 1\n---\n# Ignored\n')
  w('guide/next.md', '---\ngroup: "Basics"\norder: 2\n---\n\n# Next steps\n')
  w('guide/hidden.md', '---\ntitle: Hidden\nsidebar: false\n---\n')
  w('guide/advanced/deep-dive.md', '# Deep dive\n')
  w('guide/advanced/aaa.md', '---\ntitle: Zed\norder: 5\n---\n')
  w('guide/explained.tscl', `<docs [title]="'This site, explained'" [path]="'/guide/explained'"></docs>`)
  w('guide/[step].tscl', '<p>dynamic</p>')
  w('guide/_part.tscl', '<p>partial</p>')
  w('guide/notes.txt', 'not a page')
  w('reference/cli.md', '---\ntitle: CLI\n---\n')
})

test('folder = section, frontmatter group (or the subfolder) = group, ordered by order then title', () => {
  const [guide] = pagesNav([{ key: 'guide', title: 'Guide', href: '', groups: [] }], readPages(dir))
  expect(guide!.groups).toEqual([
    { title: 'Basics', items: [{ title: 'Getting started', href: '/guide/start', order: 1 }, { title: 'Next steps', href: '/guide/next', order: 2 }] },
    { title: 'Advanced', items: [{ title: 'Zed', href: '/guide/advanced/aaa', order: 5 }, { title: 'Deep dive', href: '/guide/advanced/deep-dive' }] },
    { title: 'Guide', items: [{ title: 'This site, explained', href: '/guide/explained' }] },
  ])
  expect(guide!.href).toBe('/guide/start')
})

test('the config overrides and extends: its groups come first, its items win over pages with the same href', () => {
  const sections: Section[] = [{
    key: 'guide', title: 'Guide', href: '/guide/start',
    groups: [
      { title: 'Advanced', items: [{ title: 'Playground', href: '/playground', order: 0 }] },
      { title: 'Basics', items: [{ title: 'Start here', href: '/guide/start', order: 3 }] },
    ],
  }]
  const [guide] = pagesNav(sections, readPages(dir))
  expect(guide!.groups.map((g) => g.title)).toEqual(['Advanced', 'Basics', 'Guide'])
  expect(guide!.groups[0]!.items.map((i) => i.title)).toEqual(['Playground', 'Zed', 'Deep dive'])
  expect(guide!.groups[1]!.items.map((i) => i.title)).toEqual(['Next steps', 'Start here'])
  expect(pager([guide!], '/guide/advanced/deep-dive').next.href).toBe('/guide/next')
  expect(sections[0]!.groups[0]!.items).toHaveLength(1)
})

test('a section without a folder keeps its config; one page per section folder only', () => {
  const [ref, other] = pagesNav([
    { key: 'reference', title: 'Reference', href: '', groups: [] },
    { key: 'missing', title: 'Missing', href: '/x', groups: [{ title: 'A', items: [{ title: 'X', href: '/x' }] }] },
  ], readPages(dir))
  expect(ref!.groups).toEqual([{ title: 'Reference', items: [{ title: 'CLI', href: '/reference/cli' }] }])
  expect(other!.groups).toEqual([{ title: 'A', items: [{ title: 'X', href: '/x' }] }])
})

test('themeDocs() serves the pages as virtual:theme-docs/pages', async () => {
  const plugin = themeDocs({ pages: dir })
  const id = (plugin.resolveId as (id: string) => string | undefined)('virtual:theme-docs/pages')!
  expect(id).toBe('\0virtual:theme-docs/pages')
  const code = (plugin.load as (id: string) => string | undefined)(id)!
  expect(code).toContain('export default [')
  expect(code).toContain('{"href":"/reference/cli","title":"CLI"}')
  expect(code).not.toContain('Hidden')
})
