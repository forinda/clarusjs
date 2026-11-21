// #143: frontmatter validated against a Standard Schema (Zod, Valibot, ArkType… or any object with ~standard).
import { expect, test } from 'vitest'
import markdown, { type StandardSchema } from '../src/index.ts'

// A small Standard Schema by hand: title (required string), order (coerced to a number, default 0).
const guide: StandardSchema<{ title: string; order: number }> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate(value) {
      const data = (value ?? {}) as Record<string, unknown>
      const issues = []
      if (typeof data.title !== 'string') issues.push({ message: 'Expected string', path: ['title'] })
      const order = data.order === undefined ? 0 : Number(data.order)
      if (Number.isNaN(order)) issues.push({ message: 'Expected number', path: [{ key: 'order' }] })
      return issues.length ? { issues } : { value: { ...data, title: data.title as string, order } }
    },
  },
}
const page = (options: Parameters<typeof markdown>[0], file: string, code: string) =>
  markdown(options).toTscl(code, `/app/src/pages/${file}`, { route: `/${file.replace(/\.md$/, '')}`, root: '/app', addDependency: () => {} })

test('valid frontmatter passes; the schema\'s output (defaults, coercions) is what the page gets', () => {
  const out = page({ schema: guide, layout: '/src/layouts/docs.tscl' }, 'guide/a.md', '---\ntitle: Hello\norder: "3"\n---\n\nBody\n')
  expect(out).toContain('[title]="\'Hello\'"')
})

test('invalid frontmatter fails with the file and each issue\'s path', () => {
  expect(() => page({ schema: guide }, 'guide/b.md', '---\norder: soon\n---\n\nBody\n')).toThrow(
    'src/pages/guide/b.md: frontmatter.title: Expected string\nsrc/pages/guide/b.md: frontmatter.order: Expected number',
  )
})

test('one schema per folder (globs under src/pages, the first match wins); pages no glob matches aren\'t checked', () => {
  const schema = { 'guide/**': guide, 'blog/*.md': guide }
  expect(() => page({ schema }, 'guide/deep/c.md', '---\n---\n\nx\n')).toThrow('frontmatter.title: Expected string')
  expect(() => page({ schema }, 'blog/post.md', '---\n---\n\nx\n')).toThrow('frontmatter.title')
  expect(() => page({ schema }, 'blog/2026/post.md', '---\n---\n\nx\n')).not.toThrow() // * is one segment
  expect(() => page({ schema }, 'about.md', '# About\n')).not.toThrow()
})

test('an asynchronous schema is a clear error (pages are converted synchronously)', () => {
  const later: StandardSchema = { '~standard': { version: 1, vendor: 'test', validate: async (value) => ({ value }) } }
  expect(() => page({ schema: later }, 'a.md', '---\ntitle: x\n---\n')).toThrow('src/pages/a.md: the frontmatter schema validated asynchronously; markdown({ schema }) needs a synchronous schema')
})
