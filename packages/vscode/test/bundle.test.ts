// The built extension loads as VS Code loads it (CommonJS, `vscode` external), registers its providers on activate,
// and its hover provider answers: a stub `vscode` module stands in for the editor.
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import Module from 'node:module'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const pkg = resolve(import.meta.dirname, '..')

test('the bundle activates and serves hover for a component', () => {
  execFileSync(process.execPath, [resolve(pkg, 'node_modules/vite/bin/vite.js'), 'build', '--logLevel', 'silent'], { cwd: pkg })
  const providers: Record<string, any> = {}
  class Range { constructor(public start: unknown, public end: unknown) {} }
  class Hover { constructor(public contents: any, public range: Range) {} }
  class MarkdownString { constructor(public value: string) {} }
  const vscode = {
    Range, Hover, MarkdownString, SnippetString: class {}, CompletionItem: class {},
    workspace: { textDocuments: [] },
    languages: {
      registerHoverProvider: (lang: string, p: unknown) => { providers[`hover:${lang}`] = p; return { dispose() {} } },
      registerCompletionItemProvider: (lang: string, p: unknown) => { providers[`complete:${lang}`] = p; return { dispose() {} } },
    },
  }
  const resolveFilename = (Module as any)._resolveFilename
  ;(Module as any)._resolveFilename = function (request: string, ...rest: unknown[]) { return request === 'vscode' ? 'vscode' : resolveFilename.call(this, request, ...rest) }
  stubModule(vscode)
  try {
    const extension = createRequire(import.meta.url)(resolve(pkg, 'dist/extension.js'))
    const subscriptions: unknown[] = []
    extension.activate({ subscriptions })
    expect(subscriptions).toHaveLength(2)
    const text = "@import card from './card.tscl'\n<card />\n"
    const doc = { getText: () => text, uri: { fsPath: '/nowhere/page.tscl' }, offsetAt: (p: number) => p, positionAt: (o: number) => o }
    const hover = providers['hover:tscl'].provideHover(doc, text.indexOf('<card') + 2)
    expect(hover.contents.value).toContain('./card.tscl')
  } finally {
    ;(Module as any)._resolveFilename = resolveFilename
    delete (Module as any)._cache.vscode
  }
}, 60_000)

function stubModule(exports: object) {
  const stub = new Module('vscode')
  stub.exports = exports
  stub.loaded = true
  ;(Module as any)._cache.vscode = stub
}
