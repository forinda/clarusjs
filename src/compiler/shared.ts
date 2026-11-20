// Small helpers shared by both emitters.
import type { ComponentIR } from './ir.ts'

/** `const { start = 0, name } = props`, or '' when the component has no inputs. */
export function inputsLine(ir: ComponentIR): string {
  if (!ir.inputs.length) return ''
  const parts = ir.inputs.map((i) => (i.default !== undefined ? `${i.name} = ${i.default}` : i.name))
  return `  const { ${parts.join(', ')} } = props\n`
}

/** Dedent a script block and indent it by two spaces, one statement line per line. */
export function indentScript(code: string): string {
  const lines = code.replace(/^\s*\n/, '').replace(/\s+$/, '').split('\n')
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)![0].length))
  return lines.map((l) => '  ' + l.slice(indent)).join('\n') + '\n'
}

export const renderName = (name: string) => 'render_' + name.replace(/[^\w$]/g, '_')
