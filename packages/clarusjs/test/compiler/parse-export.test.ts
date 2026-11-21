import { expect, test } from 'vitest'
import { parse } from '../../src/compiler/index.ts'

test('parse is a public export; multi-line input types stay whole', () => {
  const p = parse('@input user: {\n  name: string\n}\n<b>{{ user.name }}</b>', 'x.tscl')
  expect(p.inputs[0].type).toContain('\n')
})
