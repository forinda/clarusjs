// The TypeScript 7.1 content mapper (`clarusjs mapper`): .tscl → TypeScript with a span map, template errors as
// mapper diagnostics, the JSON-RPC protocol over stdio, and a real `tsc --runExternalCode` run on a small project.
import { spawn, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { transform } from '../../src/cli/mapper.ts'

const pkg = resolve(import.meta.dirname, '../..')
const cli = resolve(pkg, 'src/cli/index.ts')

test('transform: TypeScript text, verbatim spans that match the template, component imports to the .tscl file', () => {
  const content = "@import card from './card.tscl'\n@input count: number\n<script>\n  let n = state(count)\n</script>\n<card [title]=\"'x'\" />\n<p>{{ n.toFixed(1) }}</p>\n"
  const out = transform({ fileName: '/app/src/pages/index.tscl', content })
  expect(out.extension).toBe('.ts')
  expect(out.diagnostics).toEqual([])
  expect(out.text).toContain(`from "./card.tscl"`) // the compiler hands ./card.tscl to the mapper too
  expect(out.text).not.toContain('card.tscl.ts')
  let end = 0
  for (const [vStart, vLength, oStart, oLength, kind] of out.mappings) {
    expect(vStart).toBeGreaterThanOrEqual(end) // ordered and disjoint in the virtual text
    end = vStart + vLength
    expect(oStart + oLength).toBeLessThanOrEqual(content.length)
    if (kind === 0) expect(out.text.slice(vStart, vStart + vLength)).toBe(content.slice(oStart, oStart + oLength))
    else expect(kind).toBe(1)
  }
  const at = (text: string) => out.mappings.find(([v, l, , , k]) => k === 0 && out.text.slice(v, v + l) === text)
  expect(at('n.toFixed(1)')?.[2]).toBe(content.indexOf('n.toFixed(1)'))
})

test('transform: a template error is a mapper diagnostic at its place, and the file is still a module', () => {
  const content = '<p>\n  @if (x {\n</p>\n'
  const out = transform({ fileName: '/app/src/a.tscl', content })
  expect(out.diagnostics).toHaveLength(1)
  const d = out.diagnostics[0]!
  expect(d.messageText).not.toMatch(/^\/app/) // the position is the diagnostic's, not part of its message
  expect(d.start).toBeGreaterThan(content.indexOf('@if') - 1)
  expect(out.text).toContain('export')
})

test('transform: a stand-in for a whole construct maps to all of it, with no language features (errors only)', () => {
  const content = "@import card from './card.tscl'\n<card [(open)]=\"shown\" />\n"
  const out = transform({ fileName: '/app/src/pages/index.tscl', content })
  const atoms = out.mappings.filter(([, , , , kind]) => kind === 1)
  const of = (name: string) => atoms.find(([v, l]) => out.text.slice(v, v + l) === name)
  // The component's props object stands for the tag; the model check for the binding's name.
  expect(of('__cl_p')?.slice(2)).toEqual([content.indexOf('<card'), '<card'.length, 1, 0])
  expect(of('__cl_m')?.slice(2)).toEqual([content.indexOf('[(open)]'), '[(open)]'.length, 1, 0])
  // Verbatim copies keep every feature (no sixth value).
  expect(out.mappings.filter(([, , , , kind]) => kind === 0).every((m) => m.length === 5)).toBe(true)
})

/** One framed JSON-RPC exchange with a `clarusjs mapper` process. */
async function exchange(requests: object[]): Promise<{ id: number; result?: any; error?: any }[]> {
  const child = spawn(process.execPath, [cli, 'mapper'], { cwd: pkg })
  const responses: any[] = []
  let pending = Buffer.alloc(0)
  const done = new Promise<void>((resolve) => child.stdout.on('data', (chunk: Buffer) => {
    pending = Buffer.concat([pending, chunk])
    for (;;) {
      const headerEnd = pending.indexOf('\r\n\r\n')
      if (headerEnd === -1) break
      const length = Number(/Content-Length: (\d+)/.exec(pending.subarray(0, headerEnd).toString())![1])
      if (pending.length < headerEnd + 4 + length) break
      responses.push(JSON.parse(pending.subarray(headerEnd + 4, headerEnd + 4 + length).toString()))
      pending = pending.subarray(headerEnd + 4 + length)
    }
    if (responses.length === requests.length) resolve()
  }))
  for (const r of requests) {
    const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', ...r }))
    child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`)
    child.stdin.write(body)
  }
  await done
  child.stdin.end()
  return responses
}

test('protocol: initialize, openProject, transform and closeProject over framed stdio', async () => {
  const [init, open, out, close, unknown] = await exchange([
    { id: 1, method: 'initialize', params: { positionEncodings: ['utf-8', 'utf-16'] } },
    { id: 2, method: 'openProject', params: { configFileName: '/app/tsconfig.json', projectHandle: 'p' } },
    { id: 3, method: 'transform', params: { fileName: '/app/src/a.tscl', content: '<p>{{ 1 }}</p>\n', projectHandle: 'p' } },
    { id: 4, method: 'closeProject', params: { projectHandle: 'p' } },
    { id: 5, method: 'nope', params: {} },
  ])
  expect(init!.result).toEqual({ positionEncoding: 'utf-16', diagnosticSource: 'clarus' })
  expect(open!.result).toEqual({})
  expect(out!.result.extension).toBe('.ts')
  expect(close!.result).toBe(null)
  expect(unknown!.error.code).toBe(-32601)
})

test('the package declares the mapper for TypeScript: `contentMappers: [{ package: "clarusjs" }]`', () => {
  const json = JSON.parse(readFileSync(resolve(pkg, 'package.json'), 'utf8'))
  expect(json.typescript.contentMapper.exec).toEqual(['node', './dist/cli/index.js', 'mapper'])
})

test('tsc 7.1 with the mapper reports template type errors at their .tscl place, and template syntax errors', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'cl-mapper-'))
  cpSync(resolve(pkg, 'test/fixtures/mapper-app'), dir, { recursive: true })
  // A stand-in for the installed package, running the mapper from source.
  mkdirSync(resolve(dir, 'node_modules/clarusjs'), { recursive: true })
  writeFileSync(resolve(dir, 'node_modules/clarusjs/package.json'), JSON.stringify({ name: 'clarusjs', typescript: { contentMapper: { exec: [process.execPath, cli, 'mapper'] } } }))
  const tsc = () => spawnSync(process.execPath, [resolve(pkg, 'node_modules/typescript-beta/bin/tsc'), '-p', '.', '--runExternalCode', '--pretty', 'false'], { cwd: dir, encoding: 'utf8' })
    .stdout.trim().split('\n').map((l) => l.replace(/: error (\w+):.*/, ' $1'))
  expect(tsc()).toEqual([
    'src/card.tscl(3,14) TS2339', // {{ title.nope }}
    'src/missing.tscl(2,1) TS2741', // <card />: title is missing
    'src/page.tscl(2,8) TS2322', // <card [title]="1" />: a number for a string input
  ])
  // The missing prop is underlined on the whole tag name.
  const pretty = spawnSync(process.execPath, [resolve(pkg, 'node_modules/typescript-beta/bin/tsc'), '-p', '.', '--runExternalCode', '--pretty', 'true'], { cwd: dir, encoding: 'utf8' }).stdout.replace(/\x1b\[[0-9;]*m/g, '')
  const lines = pretty.split('\n')
  const at = lines.findIndex((l) => l.includes('missing.tscl:2:1'))
  expect(lines.slice(at).find((l) => l.includes('~'))?.trim()).toBe('~~~~~')
  // A template that doesn't parse is a syntax error: tsc reports it (and, as for any syntax error, stops there).
  writeFileSync(resolve(dir, 'src/broken.tscl'), '<p>ok</p>\n@if (true {\n')
  expect(tsc()).toEqual(['src/broken.tscl(2,5) clarus1'])
})
