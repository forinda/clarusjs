import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ui = readFileSync(resolve(import.meta.dirname, '../../ui/src/ui.css'), 'utf8')
/** CSS without comments, whitespace collapsed. */
export const collapse = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim()

/** The rules between /* part: name *\/ and /* end part *\/ in @clarusjs/ui's ui.css, collapsed. */
export function uiSection(name: string): string {
  const m = new RegExp(`/\\* part: ${name} \\*/([\\s\\S]*?)/\\* end part \\*/`).exec(ui)
  if (!m) throw new Error(`ui.css has no part section "${name}"`)
  return collapse(m[1]!)
}

/** A registry file's global rules, collapsed: a .css file whole, a .tscl file's <style global> block. */
export function globalStyle(source: string, file = '.tscl'): string {
  const css = file.endsWith('.css') ? source : (/<style global>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? '')
  return unlayer(collapse(css))
}

/** The rules inside one wrapping @layer components { … }, collapsed (the text as is when there's none). */
export function unlayer(collapsed: string): string {
  const m = /^@layer components \{ ([\s\S]*) \}$/.exec(collapsed)
  return m ? m[1]!.trim() : collapsed
}
