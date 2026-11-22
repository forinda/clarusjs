// #339: typescript-eslint's type-aware rules on .tscl scripts, with types from the component's inputs, imported data
// and signals; and a clear error when the TypeScript they need (6) isn't there.
import { resolve } from 'node:path'
import { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { expect, test } from 'vitest'
import clarusjs from '../src/index.ts'

const filename = resolve(import.meta.dirname, 'fixtures/app/src/components/x.tscl')
const run = (code: string, rules: Linter.RulesRecord, parserOptions: object = {}) =>
  new Linter().verify(code, [
    ...clarusjs.configs.recommended,
    { files: ['**/*.tscl'], plugins: { '@typescript-eslint': tseslint.plugin }, languageOptions: { parserOptions: { parser: tseslint.parser, typeAware: true, ...parserOptions } }, rules },
  ], filename)
const where = (messages: Linter.LintMessage[]) => messages.map((m) => `${m.line}:${m.column} ${m.ruleId}${m.fatal ? ' ' + m.message : ''}`)

const source = `@input start: number = 0
@input user: { name: string }
@import { site, loose } from '../site.ts'

<script>
  let count = state(start)
  const label = user.name.toUpperCase() + site.name
  site.load()
  const x = loose.anything
</script>

<p>{{ count }} {{ label }} {{ x }}</p>
`

test('a type-aware rule reports in the script, at its .tscl line and column', () => {
  expect(where(run(source, { '@typescript-eslint/no-floating-promises': 'error' }))).toEqual(['8:3 @typescript-eslint/no-floating-promises'])
})

test("types come from the inputs, the imported data and state(): only what is really any is unsafe", () => {
  expect(where(run(source, { '@typescript-eslint/no-unsafe-member-access': 'error', '@typescript-eslint/no-unsafe-assignment': 'error' }))).toEqual([
    '9:9 @typescript-eslint/no-unsafe-assignment',
    '9:19 @typescript-eslint/no-unsafe-member-access',
  ])
  // count is a number: adding it to a string is flagged by a rule that reads types.
  expect(where(run(source.replace("site.load()", "const s = 'n' + count"), { '@typescript-eslint/restrict-plus-operands': ['error', { allowNumberAndString: false }] }))).toEqual(['8:13 @typescript-eslint/restrict-plus-operands'])
})

test('the declarations behind the types are not part of the file ESLint sees', () => {
  const messages = run(source, { 'no-unused-vars': 'error', 'no-undef': 'error', '@typescript-eslint/no-unused-vars': 'error' })
  expect(messages).toEqual([])
})

test('a file without a script, and the other rules, work as without typeAware', () => {
  expect(run('<img src="/a.png" />\n', {}).map((m) => m.ruleId)).toEqual(['clarusjs/template'])
  expect(where(run(source.replace('const label', 'let label'), { 'prefer-const': 'error' }))).toEqual(['7:7 prefer-const'])
})

test('without TypeScript 6 for typescript-eslint: an error that says what to install', () => {
  const [m] = run(source, {}, { typescript: { version: '7.0.2', versionMajorMinor: '7.0' } })
  expect(m).toMatchObject({ fatal: true, message: expect.stringContaining('type-aware linting of .tscl files needs TypeScript 6') })
  expect(m!.message).toContain('found TypeScript 7.0.2')
  expect(m!.message).toContain('@typescript/typescript6')
})

test('typeAware needs typescript-eslint as the parser', () => {
  const [m] = new Linter().verify(source, [...clarusjs.configs.recommended, { files: ['**/*.tscl'], languageOptions: { parserOptions: { typeAware: true } } }], filename)
  expect(m).toMatchObject({ fatal: true, message: expect.stringContaining('parserOptions.parser') })
})

test('fixes apply to the .tscl file in type-aware mode too', () => {
  const out = new Linter().verifyAndFix(source.replace('const label', 'let label'), [
    ...clarusjs.configs.recommended,
    { files: ['**/*.tscl'], languageOptions: { parserOptions: { parser: tseslint.parser, typeAware: true } }, rules: { 'prefer-const': 'error' } },
  ], filename)
  expect(out.output).toBe(source)
})

test('no typescript-eslint (or no TypeScript) where the file is: the same error, saying none was found', async () => {
  const { requireTypeScript6 } = await import('../src/type-aware.ts')
  expect(() => requireTypeScript6(undefined)).toThrow(/found no TypeScript\. Install Microsoft's compatibility package/)
})

test("the Lint guide's config: typescript-eslint's type-checked presets on .tscl files", () => {
  const config = [
    ...tseslint.configs.recommendedTypeCheckedOnly.map((c) => ({ ...c, files: ['**/*.tscl'] })),
    ...clarusjs.configs.recommended,
    { files: ['**/*.tscl'], languageOptions: { parserOptions: { parser: tseslint.parser, typeAware: true } } },
  ] as Linter.Config[]
  const ids = new Linter().verify(source, config, filename).map((m) => `${m.line}:${m.column} ${m.ruleId}${m.fatal ? ' ' + m.message : ''}`)
  expect(ids).toContain('8:3 @typescript-eslint/no-floating-promises')
  expect(ids).toContain('9:9 @typescript-eslint/no-unsafe-assignment')
})
