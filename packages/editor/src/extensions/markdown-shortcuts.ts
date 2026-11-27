// Markdown as you type: **bold**, *italic* or _italic_, `code`, and ``` for a code block, each for the marks and
// nodes the editor has.
import { InputRule, textblockTypeInputRule } from 'prosemirror-inputrules'
import type { MarkType } from 'prosemirror-model'
import { defineExtension } from '../core/extension.ts'

/** A rule that turns the matched text into its first group, marked with `type`. */
const markRule = (pattern: RegExp, type: MarkType) =>
  new InputRule(
    pattern,
    (state, match, start, end) => {
      // a mention or line break inside the match: leave it as typed (rebuilding it as text would lose them)
      let leaf = false
      state.doc.nodesBetween(start, end, (node) => { if (node.isInline && !node.isText) leaf = true })
      if (leaf) return null
      // the delimiters go and the mark goes on what's between, keeping marks already there (**a _b_ c**)
      const open = match[0].indexOf(match[1]!)
      const from = start + open
      const to = from + match[1]!.length
      return state.tr.delete(to, end).addMark(from, to, type.create()).delete(start, from).removeStoredMark(type)
    },
    { inCodeMark: false }, // inside inline code, ** and ` are code
  )

/**
 * Markdown shortcuts while typing.
 * @see https://clarusjs.com/guide/editor-composer#extensions
 */
export const markdownShortcuts = defineExtension({
  name: 'markdownShortcuts',
  inputRules: (schema) => [
    schema.marks.strong && markRule(/\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/, schema.marks.strong),
    schema.marks.em && markRule(/(?<![*\w])\*([^*\s](?:[^*]*[^*\s])?)\*$/, schema.marks.em),
    schema.marks.em && markRule(/(?<![_\w])_([^_\s](?:[^_]*[^_\s])?)_$/, schema.marks.em),
    schema.marks.code && markRule(/`([^`]+)`$/, schema.marks.code),
    schema.nodes.code_block && textblockTypeInputRule(/^```$/, schema.nodes.code_block),
  ].filter((r): r is InputRule => !!r),
})
