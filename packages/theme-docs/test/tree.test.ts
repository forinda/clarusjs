// The sidebar from the files under src/pages: themeDocs() reads them (readPages), pagesNav merges them with the config.
import { execFileSync } from 'node:child_process'
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
  expect(code).toContain('{"href":"/reference/cli","title":"CLI","file":"reference/cli.md"}')
  expect(code).toContain('{"href":"/guide/hidden","title":"Hidden","file":"guide/hidden.md","hidden":true}')
})

test('each page carries its source file; dynamic routes are listed for edit links but hidden from the sidebar', () => {
  const pages = readPages(dir)
  expect(pages.find((p) => p.href === '/guide/start')).toMatchObject({ file: 'guide/start.md' })
  expect(pages.find((p) => p.href === '/guide/[step]')).toMatchObject({ file: 'guide/[step].tscl', hidden: true })
  expect(pages.find((p) => p.href === '/guide/hidden')).toMatchObject({ hidden: true })
  expect(pages.some((p) => p.file.includes('_part'))).toBe(false)
})

test('updated: the last commit that touched the page (one git log for all pages); none outside git', () => {
  const repo = mkdtempSync(resolve(tmpdir(), 'theme-git-'))
  mkdirSync(resolve(repo, 'src/pages/guide'), { recursive: true })
  writeFileSync(resolve(repo, 'src/pages/guide/a.md'), '# A\n')
  writeFileSync(resolve(repo, 'src/pages/guide/b.md'), '# B\n')
  const git = (args: string[], date: string) => execFileSync('git', args, { cwd: repo, env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } })
  git(['init', '-q'], '@1700000000 +0000')
  git(['-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '.'], '@1700000000 +0000')
  git(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'one'], '@1700000000 +0000')
  writeFileSync(resolve(repo, 'src/pages/guide/b.md'), '# B2\n')
  git(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qam', 'two'], '@1700100000 +0000')
  const pages = readPages(resolve(repo, 'src/pages'))
  expect(pages.find((p) => p.href === '/guide/a')!.updated).toBe(1700000000)
  expect(pages.find((p) => p.href === '/guide/b')!.updated).toBe(1700100000)
  expect(readPages(dir).every((p) => p.updated === undefined)).toBe(true)
}, 20_000) // five git processes: past the default 5s when the whole suite runs at once

test("a section's index page belongs to it; an empty href falls to the first page of the first group with one", () => {
  const pages = [{ href: '/guide', title: 'Overview', file: 'guide/index.md', order: 0 }, { href: '/guidebook/x', title: 'Other', file: 'guidebook/x.md' }, { href: '/guide/a', title: 'A', file: 'guide/a.md', group: 'Late' }]
  const [guide] = pagesNav([{ key: 'guide', title: 'Guide', href: '', groups: [{ title: 'Empty', items: [] }, { title: 'Late', items: [] }] }], pages)
  expect(guide!.groups.flatMap((g) => g.items.map((i) => i.href))).toEqual(['/guide/a', '/guide'])
  expect(guide!.href).toBe('/guide/a')
})

test('frontmatter: a # comment after a value is not part of it, a # inside quotes is', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'theme-fm-'))
  mkdirSync(resolve(dir, 'guide'))
  writeFileSync(resolve(dir, 'guide/a.md'), '---\ntitle: "C# basics" # the title\norder: 2 # second\ngroup: \'A # B\'\n---\n')
  writeFileSync(resolve(dir, 'guide/b.md'), '---\ntitle: B\nsidebar: false # hide it\n---\n')
  expect(readPages(dir)).toEqual([
    { href: '/guide/a', title: 'C# basics', file: 'guide/a.md', group: 'A # B', order: 2 },
    { href: '/guide/b', title: 'B', file: 'guide/b.md', hidden: true },
  ])
})

test("#369: a group's icon and collapsed state come through, and a page's badge (frontmatter) reaches its item", () => {
  const pages = mkdtempSync(resolve(tmpdir(), 'theme-badge-'))
  mkdirSync(resolve(pages, 'guide'))
  writeFileSync(resolve(pages, 'guide/tailwind.md'), '---\ntitle: Tailwind CSS\ngroup: Templates\nbadge: New\n---\n# Tailwind CSS\n')
  writeFileSync(resolve(pages, 'guide/lists.md'), '---\ntitle: Lists\ngroup: Templates\n---\n# Lists\n')
  writeFileSync(resolve(pages, 'guide/deploy.md'), '---\ntitle: Deploy\ngroup: Build & deploy\n---\n# Deploy\n')
  const config: Section[] = [{ key: 'guide', title: 'Guide', href: '', groups: [{ title: 'Templates', icon: 'code', items: [] }, { title: 'Build & deploy', icon: 'download', collapsed: true, items: [] }] }]
  const [guide] = pagesNav(config, readPages(pages))
  expect(guide!.groups.map((g) => [g.title, g.icon, g.collapsed])).toEqual([['Templates', 'code', undefined], ['Build & deploy', 'download', true]])
  expect(guide!.groups[0]!.items).toEqual([{ title: 'Lists', href: '/guide/lists' }, { title: 'Tailwind CSS', href: '/guide/tailwind', badge: 'New' }])
})
