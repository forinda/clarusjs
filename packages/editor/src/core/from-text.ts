// A document from plain text, as a textarea holds it: a blank line starts a paragraph, a line break is a hard break.
// Used when the editor takes over a textarea, and on the server for a post made without JavaScript (format 'text').
import type { Node, Schema } from 'prosemirror-model'

/** A document from plain text (blank lines apart: paragraphs; a line break: a hard break), and where `caret` falls. */
export function fromText(schema: Schema, text: string, caret?: number): { doc: Node; pos?: number } {
  const blocks: Node[][] = [[]]
  let buf = ''
  let pos = 1 // inside the first paragraph
  let at: number | undefined
  const flush = () => { if (buf) blocks[blocks.length - 1]!.push(schema.text(buf)); buf = '' }
  for (let i = 0; i < text.length;) {
    if (i === caret) at = pos
    if (text.startsWith('\n\n', i)) {
      if (caret === i + 1) at = pos
      flush()
      blocks.push([])
      pos += 2 // out of one paragraph, into the next
      i += 2
    } else if (text[i] === '\n') {
      flush()
      blocks[blocks.length - 1]!.push(schema.nodes.hard_break!.create())
      pos += 1
      i += 1
    } else {
      buf += text[i]
      pos += 1 // positions count UTF-16 units, as strings do
      i += 1
    }
  }
  if (caret !== undefined && caret >= text.length) at = pos
  flush()
  return { doc: schema.node('doc', null, blocks.map((b) => schema.node('paragraph', null, b))), pos: at }
}

/**
 * The position in `doc` for an offset into its plain text, counted as plainText() counts it (blocks apart by a blank
 * line, a hard break one character, a mention its "@label"): where a textarea's caret goes in the rich document.
 */
export function posAtOffset(doc: Node, offset: number): number {
  let left = Math.max(0, offset)
  let blockStart = 0
  let end = 1
  for (let i = 0; i < doc.childCount; i++) {
    const block = doc.child(i)
    if (i > 0) {
      if (left < 2) return end // on the blank line parting two blocks: the end of the first
      left -= 2
    }
    let p = blockStart + 1
    for (let j = 0; j < block.childCount; j++) {
      const child = block.child(j)
      const len = child.isText ? child.text!.length : child.type.name === 'hard_break' ? 1 : (child.type.spec.leafText?.(child) ?? '').length
      if (left <= len) return child.isText ? p + left : left === 0 ? p : p + child.nodeSize
      left -= len
      p += child.nodeSize
    }
    end = p
    if (left === 0) return end
    blockStart += block.nodeSize
  }
  return end
}
