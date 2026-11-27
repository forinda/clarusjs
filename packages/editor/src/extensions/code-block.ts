// Code blocks: <pre><code>, plain text only (no marks), whitespace kept.
import { setBlockType } from 'prosemirror-commands'
import { defineExtension } from '../core/extension.ts'

/**
 * Code blocks: the command `codeBlock` turns the current block into one, or back into a paragraph.
 * @see https://clarusjs.com/guide/editor-composer#extensions
 */
export const codeBlock = defineExtension({
  name: 'codeBlock',
  requires: ['base'],
  nodes: {
    code_block: {
      content: 'text*', marks: '', group: 'block', code: true, defining: true,
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
      render: () => ['pre', ['code', 0]],
    },
  },
  commands: (schema) => ({
    codeBlock: () => (state, dispatch) =>
      state.selection.$from.parent.type === schema.nodes.code_block
        ? setBlockType(schema.nodes.paragraph!)(state, dispatch)
        : setBlockType(schema.nodes.code_block!)(state, dispatch),
  }),
})
