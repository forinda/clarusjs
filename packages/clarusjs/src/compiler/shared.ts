// Small helpers shared by both emitters.
import type { ComponentIR } from './ir.ts'
import { templateRanges } from './script.ts'

/** `const { start = 0, name } = props`, or '' when the component has no inputs. */
export function inputsLine(ir: ComponentIR): string {
  if (!ir.inputs.length) return ''
  const parts = ir.inputs.map((i) => (i.default !== undefined ? `${i.name} = ${i.default}` : i.name))
  return `  const { ${parts.join(', ')} } = __cl_props\n`
}

/** Dedent a script block and indent it by two spaces, one statement line per line. */
export function indentScript(code: string): string {
  const body = code.replace(/^\s*\n/, '').replace(/\s+$/, '')
  const ranges = templateRanges(body)
  let offset = 0
  const lines = body.split('\n').map((text) => {
    const start = offset
    offset += text.length + 1
    // A line that starts inside a template literal is string content: never re-indent it.
    return { text, literal: ranges.some(([a, b]) => start > a && start < b) }
  })
  const code_ = lines.filter((l) => !l.literal && l.text.trim())
  const indent = Math.min(...code_.map((l) => l.text.match(/^\s*/)![0].length))
  return lines.map((l) => (l.literal ? l.text : '  ' + l.text.slice(indent))).join('\n') + '\n'
}

// Generated names carry a __cl_ prefix so they can't collide with names in the author's <script>.
// `-` maps to `$`, which import names cannot contain after the first character, so the mapping is one-to-one.
export const renderName = (name: string) => '__cl_render_' + name.replace(/-/g, '$')
