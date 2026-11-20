import { mkdirSync, writeFileSync } from 'node:fs'

const TMP = `${import.meta.dirname}/.tmp/`
let counter = 0

/**
 * Write compiled code to test/.tmp and import it, so vitest's aliases resolve `clarusjs/runtime*`.
 * `deps` maps an import path used in `code` (e.g. '../components/greeting.kvw') to that module's compiled code.
 */
export async function importCode(code: string, name: string, deps: Record<string, string> = {}): Promise<any> {
  mkdirSync(TMP, { recursive: true })
  const id = `${name}-${process.pid}-${counter++}`
  for (const [path, depCode] of Object.entries(deps)) {
    const depFile = `${id}-dep-${counter++}.mjs`
    writeFileSync(TMP + depFile, depCode)
    code = code.split(`'${path}'`).join(`'./${depFile}'`)
  }
  writeFileSync(`${TMP}${id}.mjs`, code)
  return import(/* @vite-ignore */ `${TMP}${id}.mjs`)
}
