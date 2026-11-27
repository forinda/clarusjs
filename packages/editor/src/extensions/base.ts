// The base every editor needs: a document of paragraphs, text, and hard breaks (Shift+Enter).
import { defineExtension } from '../core/extension.ts'

/**
 * A document of paragraphs of text, with hard breaks.
 * @see https://clarusjs.com/guide/editor-composer#extensions
 */
export const base = defineExtension({
  name: 'base',
  nodes: {
    doc: { content: 'block+', render: () => ['div', 0] },
    paragraph: { content: 'inline*', group: 'block', parseDOM: [{ tag: 'p' }], render: () => ['p', 0] },
    text: { group: 'inline' },
    hard_break: { inline: true, group: 'inline', selectable: false, parseDOM: [{ tag: 'br' }], render: () => ['br'] },
  },
})
