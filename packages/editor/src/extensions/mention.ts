// Mentions: an inline node holding who ({ id, label }), rendered <span data-mention="id">@label</span> for the app to
// style or link. Whether the id exists is the app's to check on the server.
import type { Command } from 'prosemirror-state'
import { defineExtension } from '../core/extension.ts'

/**
 * Mentions: the node `mention` with the attributes `id` and `label`, and the command `mention(attrs, range?)` that
 * inserts one (a suggestion's pick: `editor.run('mention', item, range)`).
 * @see https://clarusjs.com/guide/editor-composer#mentions
 */
export const mention = defineExtension({
  name: 'mention',
  requires: ['base'],
  nodes: {
    mention: {
      attrs: { id: {}, label: {} },
      inline: true, group: 'inline', atom: true, selectable: false,
      parseDOM: [{ tag: 'span[data-mention]', getAttrs: (el) => ({ id: (el as HTMLElement).getAttribute('data-mention'), label: ((el as HTMLElement).textContent ?? '').replace(/^@/, '') }) }],
      leafText: (node) => `@${node.attrs.label}`,
      render: (node) => ['span', { 'data-mention': node.attrs.id }, `@${node.attrs.label}`],
    },
  },
  commands: (schema) => ({
    /** Inserts a mention, and a space after it, in place of `range` (the typed "@query") or the selection. */
    mention: (attrs: { id: string; label: string }, range?: { from: number; to: number }): Command => (state, dispatch) => {
      const { from, to } = range ?? state.selection
      const node = schema.nodes.mention!.create({ id: attrs.id, label: attrs.label })
      dispatch?.(state.tr.replaceWith(from, to, [node, schema.text(' ')]).scrollIntoView())
      return true
    },
  }),
})
