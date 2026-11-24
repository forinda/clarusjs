import { mkdirSync, writeFileSync } from 'node:fs'

const TMP = `${import.meta.dirname}/.tmp/`
let counter = 0

/**
 * HTML without the scope class every component's top-level elements carry (#279): most tests aren't about styling,
 * and test/compiler/styles.test.ts pins the class itself.
 */
export const unscoped = (html: string) => html.replace(/ class="cl-c-[\w-]+"/g, '').replace(/ cl-c-[\w-]+(?=[" ])/g, '')

/**
 * Write compiled code to test/.tmp and import it, so vitest's aliases resolve `clarusjs/runtime*`.
 * `deps` maps an import path used in `code` (e.g. '../components/greeting.tscl') to that module's compiled code.
 * A module's `render()` returns its HTML `unscoped` unless `keepScope` is set.
 */
export async function importCode(code: string, name: string, deps: Record<string, string> = {}, keepScope = false): Promise<any> {
  mkdirSync(TMP, { recursive: true })
  const id = `${name}-${process.pid}-${counter++}`
  // Deps may import each other (a component that renders another): every specifier is rewritten in each.
  const files = Object.fromEntries(Object.keys(deps).map((path) => [path, `${id}-dep-${counter++}.mjs`]))
  const relink = (text: string) => Object.entries(files).reduce((t, [path, file]) => t.split(`from '${path}'`).join(`from './${file}'`), text) // only module specifiers
  for (const [path, depCode] of Object.entries(deps)) writeFileSync(TMP + files[path], relink(depCode))
  code = relink(code)
  writeFileSync(`${TMP}${id}.mjs`, code)
  const mod = await import(/* @vite-ignore */ `${TMP}${id}.mjs`)
  if (keepScope || typeof mod.render !== 'function') return mod
  return { ...mod, render: (...args: unknown[]) => { const out = mod.render(...args); return typeof out === 'string' ? unscoped(out) : out } }
}
