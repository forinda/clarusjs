// The theme's templates type-check under strict TypeScript 7.1 with the clarusjs content mapper, as an app's editor
// and `tsc --runExternalCode` see them (TypeScript checks a package's .tscl files like any other source).
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const pkg = resolve(import.meta.dirname, '..')
const clarusjs = resolve(pkg, '../clarusjs')

test('every template is clean under strict TypeScript with the content mapper', () => {
  // The mapper from source (the built one needs `pnpm build`), and a tsconfig using it next to it in node_modules.
  const mapper = resolve(pkg, 'node_modules/clarusjs-mapper-src')
  mkdirSync(mapper, { recursive: true })
  writeFileSync(resolve(mapper, 'package.json'), JSON.stringify({ name: 'clarusjs-mapper-src', typescript: { contentMapper: { exec: [process.execPath, resolve(clarusjs, 'src/cli/index.ts'), 'mapper'] } } }))
  const config = resolve(pkg, 'node_modules/.types-check/tsconfig.json')
  mkdirSync(resolve(config, '..'), { recursive: true })
  writeFileSync(config, JSON.stringify({ extends: '../../tsconfig.json', contentMappers: [{ package: 'clarusjs-mapper-src', extensions: ['.tscl'] }], include: ['../../src'] }))
  const run = spawnSync(process.execPath, [resolve(clarusjs, 'node_modules/typescript-beta/bin/tsc'), '-p', config, '--runExternalCode', '--pretty', 'false'], { cwd: pkg, encoding: 'utf8' })
  expect(run.stdout.trim()).toBe('')
}, 60_000)
