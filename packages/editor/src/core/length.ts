// A document's length as people count it: graphemes (one emoji, family or flag included, is one), a mention counting
// as its label, each line break (a hard break, or a new paragraph) as one. Shared by the browser and the server, so a
// limit means the same on both.
import type { Node } from 'prosemirror-model'

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : undefined
const graphemes = (text: string) => (segmenter ? [...segmenter.segment(text)].length : [...text].length)

/** The text a leaf stands for, in the count. */
const leafText = (leaf: Node) => (leaf.type.name === 'mention' ? String(leaf.attrs.label ?? '') : leaf.type.name === 'hard_break' ? '\n' : '')

/**
 * The length of a document, in graphemes.
 * @example
 * length(editor.state.doc) // 3 for "👨‍👩‍👧ab"
 * @see https://clarusjs.com/guide/editor-composer#limits
 */
export function docLength(doc: Node): number {
  return graphemes(doc.textBetween(0, doc.content.size, '\n', leafText))
}
