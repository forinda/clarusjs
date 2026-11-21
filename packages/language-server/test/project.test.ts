// The project index: every .tscl file (and Markdown pages' @import lines), how imports resolve, who imports what.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { loadCompiler } from '../src/compiler.ts'
import { Project } from '../src/project.ts'

async function projectOf(files: Record<string, string>) {
  const root = mkdtempSync(resolve(tmpdir(), 'cl-ls-project-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(resolve(root, path)), { recursive: true })
    writeFileSync(resolve(root, path), text)
  }
  const compiler = await loadCompiler(root, false, () => {})
  const project = new Project(root, compiler)
  await project.load()
  return { root, project, at: (p: string) => resolve(root, p) }
}

test('indexes .tscl files and Markdown pages under src/pages; skips node_modules, dist and .clarusjs', async () => {
  const { project, at } = await projectOf({
    'src/components/card.tscl': '@input title: string\n<h2>{{ title }}</h2>\n',
    'src/pages/index.tscl': "@import card from '../components/card.tscl'\n<card [title]=\"'x'\" />\n",
    'src/pages/guide.md': "---\ntitle: x\n---\n@import card from '~/components/card.tscl'\n\n# Guide\n",
    'node_modules/x/y.tscl': '<p></p>\n',
    'dist/z.tscl': '<p></p>\n',
    '.clarusjs/w.tscl': '<p></p>\n',
  })
  expect(project.files().sort()).toEqual([at('src/components/card.tscl'), at('src/pages/guide.md'), at('src/pages/index.tscl')])
  expect(project.importersOf(at('src/components/card.tscl')).sort()).toEqual([at('src/pages/guide.md'), at('src/pages/index.tscl')])
  const imp = project.importsOf(at('src/pages/index.tscl'))[0]!
  expect(imp).toMatchObject({ name: 'card', specifier: '../components/card.tscl', target: at('src/components/card.tscl') })
  expect(project.componentAt(at('src/components/card.tscl'))?.inputs.map((i) => i.name)).toEqual(['title'])
})

test('imports resolve: relative, ~/, tsconfig paths, package specifiers', async () => {
  const { project, at } = await projectOf({
    'tsconfig.json': '{ // comments are allowed\n "compilerOptions": { "paths": { "@ui/*": ["./src/ui/*"] } } }',
    'src/ui/button.tscl': '<button></button>\n',
    'node_modules/kit/package.json': JSON.stringify({ name: 'kit', exports: { './*': './*' } }),
    'node_modules/kit/badge.tscl': '<i></i>\n',
    'src/a.tscl': "@import button from '@ui/button.tscl'\n@import badge from 'kit/badge.tscl'\n@import same from '~/ui/button.tscl'\n<p></p>\n",
  })
  expect(project.importsOf(at('src/a.tscl')).map((i) => i.target)).toEqual([at('src/ui/button.tscl'), at('node_modules/kit/badge.tscl'), at('src/ui/button.tscl')])
})

test('a file that stops parsing keeps its last good interface; update and remove keep the index current', async () => {
  const { project, at } = await projectOf({ 'src/card.tscl': '@input title: string\n<h2></h2>\n', 'src/page.tscl': "@import card from './card.tscl'\n<card />\n" })
  project.update(at('src/card.tscl'), '@input title: string\n@input size: number\n<h2>')
  expect(project.componentAt(at('src/card.tscl'))?.inputs.map((i) => i.name)).toEqual(['title']) // <h2> unclosed: last good
  project.update(at('src/card.tscl'), '@input size: number\n<h2></h2>\n')
  expect(project.componentAt(at('src/card.tscl'))?.inputs.map((i) => i.name)).toEqual(['size'])
  project.remove(at('src/page.tscl'))
  expect(project.importersOf(at('src/card.tscl'))).toEqual([])
})

test('the content mapper is configured when the nearest tsconfig.json has a clarusjs contentMappers entry', async () => {
  const { project, at } = await projectOf({
    'tsconfig.json': JSON.stringify({ contentMappers: [{ package: 'clarusjs', extensions: ['.tscl'] }] }),
    'src/a.tscl': '<p></p>\n',
    'other/tsconfig.json': '{}',
    'other/b.tscl': '<p></p>\n',
  })
  expect(project.mapperConfigured(at('src/a.tscl'))).toBe(true)
  expect(project.mapperConfigured(at('other/b.tscl'))).toBe(false)
})
