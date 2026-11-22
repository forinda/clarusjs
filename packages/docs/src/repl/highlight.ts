// The playground editor's highlighting: a .tscl source as escaped HTML with spans for its parts, drawn behind the
// textarea. One pass, no grammar library; <script> and <style> bodies are plain text (step 1 of #243).
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const span = (kind: string, s: string) => `<span class="t-${kind}">${esc(s)}</span>`

// Tried in order at each position; the first match wins.
const TOKENS: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^\{\{--[\s\S]*?(--\}\}|$)/, (m) => span('comment', m[0])],
  [/^<!--[\s\S]*?(-->|$)/, (m) => span('comment', m[0])],
  [/^\{\{[\s\S]*?(\}\}|$)/, (m) => span('hole', m[0])],
  [/^@(import|input|model|type|interface)\b/, (m) => span('dir', m[0])], // only where a line starts (see `bol`)
  [/^@(if|else|for|empty|slot)\b/, (m) => span('block', m[0])],
  [/^<\/?[A-Za-z][\w-]*/, (m) => span('tag', m[0])],
]

/** `source` as highlighted HTML; its text is `source` plus a newline (so a trailing newline still has a line). */
export function highlightTscl(source: string): string {
  let out = ''
  let i = 0
  let inTag = false
  let bol = true // at a line's start, or only spaces and tabs since: where a directive can be
  while (i < source.length) {
    const rest = source.slice(i)
    // <script> and <style>: the tag, then the body as plain text up to the closing tag.
    const raw = !inTag && /^<(script|style)\b/i.exec(rest)
    if (raw) {
      const open = rest.indexOf('>')
      const close = rest.toLowerCase().indexOf(`</${raw[1]!.toLowerCase()}`, open === -1 ? 0 : open)
      const end = close === -1 ? rest.length : close
      out += span('tag', rest.slice(0, raw[0].length)) + esc(rest.slice(raw[0].length, open === -1 ? end : open + 1)) + esc(rest.slice(open === -1 ? end : open + 1, end))
      i += end
      continue
    }
    if (inTag) {
      const attr = /^(\s+)(\[\(?[\w.:-]+\)?\]|\([\w.:-]+\)|[\w:@.-]+)/.exec(rest)
      const str = /^("[^"]*"?|'[^']*'?)/.exec(rest)
      if (rest[0] === '>' || rest.startsWith('/>')) {
        const end = rest[0] === '>' ? 1 : 2
        out += span('tag', rest.slice(0, end))
        i += end
        inTag = false
      } else if (attr) {
        const name = attr[2]!
        out += esc(attr[1]!) + span(/^[[(]/.test(name) ? 'bind' : 'attr', name)
        i += attr[0].length
      } else if (str) {
        out += span('string', str[0])
        i += str[0].length
      } else {
        out += esc(rest[0]!)
        i++
      }
      continue
    }
    let matched = false
    for (const [re, render] of TOKENS) {
      if (re === TOKENS[3]![0] && !bol) continue
      const m = re.exec(rest)
      if (m && m[0]) {
        out += render(m)
        i += m[0].length
        if (re === TOKENS[5]![0]) inTag = true
        matched = true
        bol = false
        break
      }
    }
    if (!matched) {
      const c = source[i]!
      out += esc(c)
      i++
      bol = c === '\n' || (bol && (c === ' ' || c === '\t'))
    }
  }
  return out + '\n'
}
