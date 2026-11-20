// #112: <<< code snippets and <!-- @include: --> Markdown includes, resolved at build time.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import markdown from '../src/index.ts'

function app(files: Record<string, string>) {
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-snippets-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(resolve(root, path, '..'), { recursive: true })
    writeFileSync(resolve(root, path), text)
  }
  const deps: string[] = []
  const render = (page: string) => markdown().toTscl(files[page]!, resolve(root, page), { route: '/x', root, addDependency: (f) => deps.push(f) })
  return { root, deps, render }
}

const source = 'import a from "a"\n// #region setup\nexport function setup() {\n  return 1\n}\n// #endregion setup\nexport const z = 2\n'

test('<<< imports a file as a highlighted block; @ is the project root; the file is a dependency', () => {
  const { root, deps, render } = app({ 'src/lib/setup.ts': source, 'src/pages/x.md': '<<< @/src/lib/setup.ts\n' })
  const out = render('src/pages/x.md')
  expect(out).toContain('<div class="code-block language-ts">')
  const text = out.replace(/<[^>]+>/g, '')
  expect(text).toContain('export const z')
  expect(text).not.toContain('#region')
  expect(deps).toEqual([resolve(root, 'src/lib/setup.ts')])
})

test('a #region is cut out and dedented; line highlights and a title come along; paths may be relative', () => {
  const { render } = app({ 'src/lib/setup.ts': source, 'src/pages/x.md': '<<< ../lib/setup.ts#setup{2} [setup.ts]\n' })
  const out = render('src/pages/x.md')
  expect(out).toContain('<p class="code-title">setup.ts</p>')
  expect(out.replace(/<[^>]+>/g, '')).not.toMatch(/import a|export const z/)
  expect(out.match(/<span class="line[^"]*">/g)).toEqual(['<span class="line">', '<span class="line highlighted">', '<span class="line">'])
})

test('<!-- @include: --> includes Markdown (a region too), nested, with relative links rebased', () => {
  const { deps, render } = app({
    'src/pages/x.md': '# Page\n\n<!-- @include: ../parts/intro.md -->\n\n<!-- @include: ../parts/more.md#short -->\n',
    'src/parts/intro.md': 'Intro with a [link](./details.md) and an [absolute](/guide) one.\n\n<!-- @include: ./nested.md -->\n',
    'src/parts/nested.md': 'Nested **text**.\n',
    'src/parts/more.md': 'Before.\n<!-- #region short -->\nOnly this.\n<!-- #endregion short -->\nAfter.\n',
  })
  const out = render('src/pages/x.md')
  expect(out).toContain('<a href="../parts/details.md">link</a>')
  expect(out).toContain('<a href="/guide">absolute</a>')
  expect(out).toContain('<p>Nested <strong>text</strong>.</p>')
  expect(out).toContain('<p>Only this.</p>')
  expect(out).not.toMatch(/Before\.|After\./)
  expect(deps.map((d) => d.split('/').pop())).toEqual(['intro.md', 'nested.md', 'more.md'])
})

test('the syntax inside a code fence is left alone (so docs can show it)', () => {
  const { render } = app({ 'src/pages/x.md': '```md\n<<< @/src/missing.ts\n<!-- @include: ./missing.md -->\n```\n' })
  expect(render('src/pages/x.md')).toContain('&#x3C;&#x3C;&#x3C; &#64;/src/missing.ts')
})

test('missing files, missing regions, include cycles and paths outside the project are errors naming the page', () => {
  const { render } = app({
    'src/pages/a.md': '<<< @/src/nope.ts\n',
    'src/pages/b.md': '<<< @/src/pages/a.md#nope\n',
    'src/pages/c.md': '<!-- @include: ./d.md -->\n',
    'src/pages/d.md': '<!-- @include: ./c.md -->\n',
    'src/pages/e.md': '<<< @/../etc/passwd\n',
  })
  expect(() => render('src/pages/a.md')).toThrow(/src\/pages\/a\.md: <<< @\/src\/nope\.ts: file not found/)
  expect(() => render('src/pages/b.md')).toThrow(/region "nope" not found/)
  expect(() => render('src/pages/c.md')).toThrow(/include cycle: .*c\.md → .*d\.md → .*c\.md/)
  expect(() => render('src/pages/e.md')).toThrow(/outside the project/)
})

// Review of #135: region and fence edge cases.
test('regions: exact names, comment-wrapped endings, nested regions, marker text in code', () => {
  const file = [
    '// #region setup-client', 'client()', '// #endregion setup-client',
    '/* #region setup */', 'a()', '// #region inner', 'b()', '// #endregion', 'c()', '/* #endregion */',
    'const marker = "#region demo"', 'z()',
  ].join('\n')
  const { render } = app({ 'src/lib/x.ts': file, 'src/pages/a.md': '<<< @/src/lib/x.ts#setup\n', 'src/pages/b.md': '<<< @/src/lib/x.ts\n' })
  const a = render('src/pages/a.md').replace(/<[^>]+>/g, '')
  expect(a).toMatch(/a\(\)\nb\(\)\nc\(\)/)
  expect(a).not.toMatch(/client\(\)|z\(\)|endregion/)
  expect(render('src/pages/b.md').replace(/<[^>]+>/g, '')).toContain('const marker = "#region demo"')
})

test('fences: a closing marker indented four spaces is code; fences in list items are recognised', () => {
  const { render } = app({ 'src/pages/x.md': '```md\n    ```\n<<< ./missing.ts\n```\n\n- ```md\n  <<< ./missing.ts\n  ```\n' })
  expect(() => render('src/pages/x.md')).not.toThrow()
})

test('includes: reference definitions are rebased; links in fenced examples are not', () => {
  const { render } = app({
    'src/parts/intro.md': 'See [demo][ref].\n\n[ref]: ./target.md\n\n```md\n[Link](./target.md)\n```\n',
    'src/pages/guide/x.md': '<!-- @include: ../../parts/intro.md -->\n',
  })
  const out = render('src/pages/guide/x.md')
  expect(out).toContain('href="../../parts/target.md"')
  expect(out.replace(/<[^>]+>/g, '')).toContain('[Link](./target.md)')
})
