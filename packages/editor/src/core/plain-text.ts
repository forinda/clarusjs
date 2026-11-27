// A value as plain text, as a textarea shows it before the editor loads: paragraphs apart by a blank line, a hard break
// as a line break, a mention as @label. DOM-free (it runs on the server).

type JSONNode = { type: string; text?: string; attrs?: Record<string, unknown>; content?: JSONNode[] }

const inline = (node: JSONNode): string =>
  node.type === 'text' ? node.text ?? ''
    : node.type === 'hard_break' ? '\n'
      : node.type === 'mention' ? `@${node.attrs?.label ?? ''}`
        : (node.content ?? []).map(inline).join('')

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
/** A numeric reference's character: U+FFFD for one that isn't a character (too large, a surrogate), as browsers do. */
const char = (n: number) => (n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff) || n === 0 ? '\uFFFD' : String.fromCodePoint(n))
const decode = (s: string) =>
  s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === '#' ? char(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : e.toLowerCase() === 'amp' ? '&' : ENTITIES[e.toLowerCase()] ?? m)

/**
 * The plain text of a value in `format`.
 * @example
 * plainText('<p>Hi</p><p>there</p>', 'html') // 'Hi\n\nthere'
 * @see https://clarusjs.com/guide/editor-composer#loading
 */
export function plainText(value: unknown, format: 'json' | 'html'): string {
  if (value == null || value === '') return ''
  if (format === 'json') {
    // It runs while a page renders: a value that isn't a document gives no text, never an error.
    try {
      const doc = (typeof value === 'string' ? JSON.parse(value) : value) as JSONNode
      return Array.isArray(doc.content) ? doc.content.map(inline).join('\n\n') : ''
    } catch {
      return ''
    }
  }
  // ponytail: tags stripped by pattern, enough for what the editor's own HTML holds; the editor parses it properly
  // once it loads.
  const text = String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|pre|h[1-6]|li|blockquote|div)>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
  return decode(text).replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '')
}
