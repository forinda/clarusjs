// <icon name="set:name" />: a built-in tag, rendered as inline SVG at build time from the resolver the caller passes.
import { expect, test } from 'vitest'
import { checkIcons, compile, parse, ClarusError, type CompileOptions } from '../../src/compiler/index.ts'
import { importCode } from '../helpers.ts'

const ICONS: Record<string, { body: string; width: number; height: number; left: number; top: number }> = {
  'test:rocket': { body: '<path d="M1 1"/>', width: 24, height: 24, left: 0, top: 0 },
  'test:wide': { body: '<path/>', width: 48, height: 24, left: 0, top: 0 },
  'test:offset': { body: '<path/>', width: 24, height: 24, left: 2, top: 3 },
}
const icon: CompileOptions['icon'] = (name) => {
  if (ICONS[name]) return { data: ICONS[name]! }
  const [set] = name.split(':')
  if (set !== 'test') return { missing: 'set', set: set! }
  return { missing: 'icon', set: 'test', suggestions: name === 'test:rockt' ? ['rocket'] : [] }
}
const html = async (src: string): Promise<string> => {
  const { code } = compile(src, { file: 'c.tscl', target: 'server', icon, scope: 'x' })
  return ((await importCode(code, 'icon', {}, true)) as { render: (p?: object) => string }).render({})
}
const error = (src: string, options: Partial<CompileOptions> = { icon }): ClarusError => {
  try {
    compile(src, { file: 'c.tscl', target: 'server', ...options })
  } catch (e) {
    if (e instanceof ClarusError) return e
    throw e
  }
  throw new Error('compiled without an error')
}

test('<icon> renders the icon as an inline svg: 1em high, the set\'s viewBox, hidden from screen readers', async () => {
  expect(await html('<p><icon name="test:rocket" /></p>')).toBe(
    '<p class="cl-c-x"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true"><path d="M1 1"/></svg></p>',
  )
})

test('a non-square icon keeps its proportions; viewBox carries left and top', async () => {
  expect(await html('<p><icon name="test:wide" /></p>')).toContain('width="2em" height="1em" viewBox="0 0 48 24"')
  expect(await html('<p><icon name="test:offset" /></p>')).toContain('viewBox="2 3 24 24"')
})

test('width and height override; a label makes it an image; other attributes pass through', async () => {
  const out = await html('<p><icon name="test:rocket" width="32" class="big" data-x="1" aria-label="Launch" /></p>')
  expect(out).toContain('<svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 24 24" role="img" width="32" class="big" data-x="1" aria-label="Launch">')
  expect(out).not.toContain('aria-hidden')
  expect(out).not.toContain('name=')
})

test("at a component's root, the scope class merges with the icon's own class", async () => {
  const out = await html('<icon name="test:rocket" class="big" />')
  expect(out).toMatch(/^<svg [^>]*class="(big cl-c-x|cl-c-x big)"/)
})

test('a bound attribute on an icon in an island is reactive like on any element', () => {
  const { code } = compile('<script>let on = state(false)</script>\n<icon name="test:rocket" [class]="on ? \'on\' : \'\'" />', { file: 'c.tscl', target: 'server', clientUrl: '/c.js', icon })
  expect(code).toContain('data-cl-a=\\"0\\"><path d=') // the svg's reactive-attribute marker, in a JS string
})

test('in an island, an icon inside @if is part of the client code; outside blocks it is not', () => {
  const inside = compile('<script>let open = state(false)</script>\n<div>@if (open) {<icon name="test:rocket" />}</div>', { file: 'c.tscl', target: 'client', icon })
  expect(inside.code).toContain('<path d=\\"M1 1\\"/>') // in a JS string
  const outside = compile('<script>let n = state(0)</script>\n<div><icon name="test:rocket" /><b>{{ n }}</b></div>', { file: 'c.tscl', target: 'client', icon })
  expect(outside.code).not.toContain('M1 1')
})

test('a component imported as icon wins over the built-in', () => {
  const { code } = compile("@import icon from './icon.tscl'\n<p><icon [name]=\"'x'\" /></p>", { file: 'c.tscl', target: 'server', icon })
  expect(code).toContain('icon.tscl')
  expect(code).not.toContain('<svg')
})

test('errors, each at the <icon>: no name, a bound name, content, a missing set or icon, no resolver', () => {
  const at = (src: string, options?: Partial<CompileOptions>) => {
    const e = error(src, options)
    return `${e.line}:${e.column} ${e.message.replace(/^\S+ /, '')}`
  }
  expect(at('<p>\n  <icon /></p>')).toBe('2:3 <icon> needs a name: <icon name="lucide:rocket" />')
  expect(at('<p><icon [name]="x" /></p>')).toMatch(/^1:4 a bound name: icons are chosen at build time; use @if between static icons/)
  expect(at('<p><icon name="test:rocket">x</icon></p>')).toBe('1:4 <icon> takes no content')
  expect(at('<p><icon name="lucide:rocket" /></p>')).toBe("1:4 no icon set 'lucide': install it with pnpm add -D @iconify-json/lucide")
  expect(at('<p><icon name="test:rockt" /></p>')).toBe("1:4 no icon 'rockt' in test (did you mean 'rocket'?)")
  expect(at('<p><icon name="test:zzz" /></p>')).toBe("1:4 no icon 'zzz' in test")
  expect(at('<p><icon name="test:rocket" /></p>', {})).toBe('1:4 icons are resolved at build time: <icon> needs clarusjs/vite or clarusjs check (the playground has no icon sets)')
})

test('a resolver that throws (an unsupported icon) is a located error', () => {
  const e = error('<p><icon name="test:rocket" /></p>', { icon: () => { throw new Error('the icon test:rocket uses hFlip, which <icon> doesn\'t support yet') } })
  expect(`${e.line}:${e.column}`).toBe('1:4')
  expect(e.message).toContain('hFlip')
})

test('checkIcons reports every icon error in a file, in @if and @for too', () => {
  const src = '<p><icon name="test:rockt" /></p>\n@if (a) {<icon name="nope:x" />}\n@for (x of xs; track x) {<icon />}\n<icon name="test:rocket" />'
  const errors = checkIcons(parse(src, 'c.tscl'), 'c.tscl', src, icon)
  expect(errors.map((e) => `${e.line}:${e.column}`)).toEqual(['1:4', '2:10', '3:26'])
})

test("the author's own aria-hidden, role, viewBox and xmlns win, each once", async () => {
  const out = await html('<p><icon name="test:rocket" aria-hidden="false" role="presentation" viewBox="0 0 1 1" /></p>')
  const svg = /<svg[^>]*>/.exec(out)![0]
  for (const name of ['aria-hidden', 'role', 'viewBox', 'xmlns', 'width', 'height']) expect(svg.match(new RegExp(` ${name}=`, 'g'))?.length ?? 0, name).toBeLessThanOrEqual(1)
  expect(svg).toContain('aria-hidden="false"')
  expect(svg).toContain('role="presentation"')
  expect(svg).toContain('viewBox="0 0 1 1"')
})

test('a name is set:icon; one without a set says so', () => {
  const e = error('<p><icon name="rocket" /></p>')
  expect(e.message).toMatch(/1:4 <icon> name is set:icon, like lucide:rocket \(got 'rocket'\)$/)
  expect(error('<p><icon name="a/../b:x" /></p>').message).toMatch(/name is set:icon/)
})
