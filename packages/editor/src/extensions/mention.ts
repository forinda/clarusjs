// Mentions: an inline node holding who ({ id, label }), rendered <span data-mention="id">@label</span> for the app to
// style or link. Whether the id exists is the app's to check on the server.
import { defineExtension } from '../core/extension.ts'

/**
 * Mentions: the node `mention` with the attributes `id` and `label`. Suggestions insert them (see `suggestion`).
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
})
