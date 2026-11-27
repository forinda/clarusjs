// Code blocks: <pre><code>, plain text only (no marks), whitespace kept.
import type { Node } from 'prosemirror-model'
import { TextSelection, type Command } from 'prosemirror-state'
import { defineExtension } from '../core/extension.ts'

/**
 * Code blocks: the command `codeBlock` turns the selected lines into one code block (a line break, or a new
 * paragraph, starts a line), or a code block back into a paragraph with a line break per line.
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
    codeBlock: (): Command => (state, dispatch) => {
      const { $from, $to } = state.selection
      const code = schema.nodes.code_block!
      const lineBreak = schema.nodes.hard_break
      const start = $from.before($from.depth)
      const end = $to.after($to.depth)
      // Out of a code block: one paragraph, its lines joined by line breaks.
      if ($from.parent.type === code && $from.sameParent($to)) {
        const lines = $from.parent.textContent.split('\n')
        const content: Node[] = []
        lines.forEach((line, i) => {
          if (i && lineBreak) content.push(lineBreak.create())
          if (line) content.push(schema.text(line))
        })
        if (dispatch) {
          const tr = state.tr.replaceWith(start, end, schema.nodes.paragraph!.create(null, content))
          dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(start + 1 + Math.min($from.parentOffset, content.reduce((n, c) => n + c.nodeSize, 0))))).scrollIntoView())
        }
        return true
      }
      // Into one: the text of every block selected, a line per line break or block.
      if ($from.depth !== $to.depth || !$from.parent.isTextblock || !$to.parent.isTextblock) return false
      const blocks: string[] = []
      state.doc.nodesBetween(start, end, (node) => {
        if (!node.isTextblock) return true
        blocks.push(node.textBetween(0, node.content.size, '\n', (leaf) => (leaf.type === lineBreak ? '\n' : (leaf.type.spec.leafText?.(leaf) ?? ''))))
        return false
      })
      const text = blocks.join('\n')
      if (dispatch) {
        const tr = state.tr.replaceWith(start, end, code.create(null, text ? schema.text(text) : null))
        dispatch(tr.setSelection(TextSelection.create(tr.doc, start + 1 + text.length)).scrollIntoView())
      }
      return true
    },
  }),
})
