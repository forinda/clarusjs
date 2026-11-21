// Which clarusjs compiler the server runs. In a trusted workspace, the project's own (so the editor agrees with its
// build) when it exports both compile and parse; otherwise the copy bundled with the server, for both. Never a mix, and
// never the project's code without trust.
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as bundled from 'clarusjs/compiler'

export type Compiler = {
  compile: typeof bundled.compile
  parse: typeof bundled.parse
  ClarusError: typeof bundled.ClarusError
  source: 'project' | 'bundled'
}

const BUNDLED: Compiler = { compile: bundled.compile, parse: bundled.parse, ClarusError: bundled.ClarusError, source: 'bundled' }

export async function loadCompiler(root: string, trusted: boolean, log: (message: string) => void): Promise<Compiler> {
  if (!trusted) {
    log('clarusjs: using the compiler bundled with the language server (the workspace isn\'t trusted)')
    return BUNDLED
  }
  // The project's own clarusjs: the trusted folder's node_modules/clarusjs only. Not a parent folder's (outside what
  // was trusted), NODE_PATH, or the server's own node_modules. A monorepo opened at a package with clarusjs hoisted
  // above it gets the bundled compiler.
  let entry: string | undefined
  if (existsSync(join(root, 'node_modules', 'clarusjs', 'package.json'))) {
    try { entry = createRequire(join(root, 'package.json')).resolve('clarusjs/compiler') } catch {}
  }
  if (!entry) {
    log('clarusjs: using the bundled compiler (the project has no clarusjs)')
    return BUNDLED
  }
  try {
    const own = await import(pathToFileURL(entry).href)
    if (typeof own.compile === 'function' && typeof own.parse === 'function' && typeof own.ClarusError === 'function') {
      log(`clarusjs: using the project's compiler (${entry})`)
      return { compile: own.compile, parse: own.parse, ClarusError: own.ClarusError, source: 'project' }
    }
    log('clarusjs: using the bundled compiler (the project\'s clarusjs is too old: it has no parse)')
  } catch (err) {
    log(`clarusjs: using the bundled compiler (the project's couldn't be loaded: ${(err as Error).message})`)
  }
  return BUNDLED
}
