// Markdown as you type: **bold**, *italic* or _italic_, `code`, and ``` for a code block, each for the marks and
// nodes the editor has.
import { InputRule, textblockTypeInputRule } from 'prosemirror-inputrules'
import type { MarkType } from 'prosemirror-model'
import { defineExtension } from '../core/extension.ts'

/** A rule that turns the matched text into its first group, marked with `type`. */
const markRule = (pattern: RegExp, type: MarkType) =>
  new InputRule(pattern, (state, match, start, end) => {
    const marks = type.create().addToSet(state.doc.resolve(start).marks())
    return state.tr.replaceWith(start, end, state.schema.text(match[1]!, marks)).removeStoredMark(type)
  })

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
