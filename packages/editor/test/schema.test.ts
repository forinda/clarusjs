// The schema, assembled from plain-object extensions: their nodes and marks, checked for what they need and exclude.
import { expect, test } from 'vitest'
import { base } from '../src/extensions/base.ts'
import { buildSchema, defineExtension } from '../src/core/schema.ts'

test('the base extension gives a document of paragraphs of text, with hard breaks', () => {
  const schema = buildSchema([base])
  expect(Object.keys(schema.nodes).sort()).toEqual(['doc', 'hard_break', 'paragraph', 'text'])
})

test('a missing requirement, a conflict and a duplicate name are errors that name the extensions', () => {
  const mention = defineExtension({ name: 'mention', requires: ['base'], nodes: {} })
  expect(() => buildSchema([mention])).toThrow('@clarusjs/editor: "mention" requires "base"')
  const a = defineExtension({ name: 'a', conflicts: ['b'] })
  const b = defineExtension({ name: 'b' })
  expect(() => buildSchema([base, a, b])).toThrow('@clarusjs/editor: "a" conflicts with "b"')
  const again = defineExtension({ name: 'again', nodes: { paragraph: { content: 'text*', group: 'block', render: () => ['p', 0] } } })
  expect(() => buildSchema([base, again])).toThrow('@clarusjs/editor: "again" and "base" both define the node "paragraph"')
})
