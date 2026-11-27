// Bold, italic and inline code: marks, their toggle commands and keys. Parsing follows prosemirror-schema-basic, so a
// paste from Google Docs (wrapped in <b style="font-weight:normal">) isn't all bold.
import { toggleMark } from 'prosemirror-commands'
import { defineExtension } from '../core/extension.ts'

/** The value of a CSS property in an element's style attribute (exact property name, not a suffix of another). */
const styleOf = (el: HTMLElement, property: string) =>
  new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i').exec(el.getAttribute('style') ?? '')?.[1]?.trim().toLowerCase()

/**
 * Bold (`strong`): Mod-b, the command `bold`.
 * @see https://clarusjs.com/guide/editor-composer#extensions
 */
export const bold = defineExtension({
  name: 'bold',
  marks: {
    strong: {
      parseDOM: [
        { tag: 'strong' },
        { tag: 'b', getAttrs: (el) => !/^(normal|400)$/.test(styleOf(el as HTMLElement, 'font-weight') ?? '') && null },
        { style: 'font-weight=400', clearMark: (m) => m.type.name === 'strong' },
        { style: 'font-weight', getAttrs: (v) => /^(bold(er)?|[5-9]\d{2,})$/.test(v as string) && null },
      ],
      render: () => ['strong', 0],
    },
  },
  commands: (schema) => ({ bold: () => toggleMark(schema.marks.strong!) }),
  keys: (schema) => ({ 'Mod-b': toggleMark(schema.marks.strong!) }),
})

/**
 * Italic (`em`): Mod-i, the command `italic`.
 * @see https://clarusjs.com/guide/editor-composer#extensions
 */
export const italic = defineExtension({
  name: 'italic',
  marks: {
    em: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }, { style: 'font-style=normal', clearMark: (m) => m.type.name === 'em' }],
      render: () => ['em', 0],
    },
  },
  commands: (schema) => ({ italic: () => toggleMark(schema.marks.em!) }),
  keys: (schema) => ({ 'Mod-i': toggleMark(schema.marks.em!) }),
})

/**
 * Inline code (`code`): Mod-e, the command `code`.
 * @see https://clarusjs.com/guide/editor-composer#extensions
 */
export const code = defineExtension({
  name: 'code',
  marks: { code: { code: true, parseDOM: [{ tag: 'code' }], render: () => ['code', 0] } },
  commands: (schema) => ({ code: () => toggleMark(schema.marks.code!) }),
  keys: (schema) => ({ 'Mod-e': toggleMark(schema.marks.code!) }),
})
