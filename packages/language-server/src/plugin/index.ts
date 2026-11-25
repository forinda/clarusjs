// The clarusjs service plugin, on the root .tscl document: the compiler's diagnostics (completion, hover, definition,
// references, renames and tokens join it in later stories). The HTML and CSS views are Volar's services'.
import type { LanguageServiceContext, LanguageServicePlugin } from '@volar/language-service'
import { URI } from 'vscode-uri'
import type { Project } from '../project.ts'
import { completions, definition, hover } from '../components.ts'
import { offsetAt } from '../positions.ts'
import { references, renameEdits, renameRange } from '../references.ts'
import { TOKEN_TYPES, tokensOf } from '../tokens.ts'
import { diagnosticsFor, quickFixes } from './diagnostics.ts'

/** The .tscl file a (possibly embedded) document belongs to. */
export function sourceUri(context: LanguageServiceContext, uri: string): string {
  return context.decodeEmbeddedDocumentUri?.(URI.parse(uri))?.[0].toString() ?? uri
}

export function createTsclServicePlugin(projectFor: (path: string) => Project): LanguageServicePlugin {
  return {
    name: 'clarusjs',
    capabilities: {
      // Only what compile() sees in one file: other files' changes don't change these.
      diagnosticProvider: { interFileDependencies: false, workspaceDiagnostics: false },
      completionProvider: { triggerCharacters: ['@', '<', ' ', '[', '(', "'", '"', '/'] },
      hoverProvider: true,
      definitionProvider: true,
      semanticTokensProvider: { legend: { tokenTypes: [...TOKEN_TYPES], tokenModifiers: [] } },
      referencesProvider: true,
      renameProvider: { prepareProvider: true },
      documentFormattingProvider: true,
      codeActionProvider: { codeActionKinds: ['quickfix'] },
    },
    create(context) {
      /** The .tscl document's path, project and text (the project synced to the buffer), or nothing for others. */
      const open = (document: { uri: string; languageId: string; getText(): string }) => {
        if (document.languageId !== 'tscl') return undefined
        const path = URI.parse(sourceUri(context, document.uri)).fsPath
        const text = document.getText()
        const project = projectFor(path)
        project.update(path, text)
        return { path, text, project }
      }
      return {
        // The whole file through the project's Prettier (see format.ts); nothing while it can't be formatted.
        async provideDocumentFormattingEdits(document) {
          const doc = open(document)
          if (!doc?.project.format) return undefined
          let out: string
          try { out = await doc.project.format(doc.text, doc.path) } catch { return undefined }
          return out === doc.text ? [] : [{ range: { start: document.positionAt(0), end: document.positionAt(doc.text.length) }, newText: out }]
        },
        // A lint finding's fix (one-root wraps the top level in <fragment>, …) as a quick fix.
        provideCodeActions(document, range) {
          const doc = open(document)
          return doc && quickFixes(doc.project, doc.path, doc.text, range)
        },
        provideDiagnostics(document) {
          const doc = open(document)
          return doc && diagnosticsFor(doc.project, doc.path, doc.text)
        },
        provideCompletionItems(document, position) {
          const doc = open(document)
          return doc && completions(doc.project, doc.path, doc.text, offsetAt(doc.text, position))
        },
        provideHover(document, position) {
          const doc = open(document)
          return doc && hover(doc.project, doc.path, doc.text, offsetAt(doc.text, position))
        },
        provideDefinition(document, position) {
          const doc = open(document)
          return doc && definition(doc.project, doc.path, doc.text, offsetAt(doc.text, position))
        },
        provideReferences(document, position) {
          const doc = open(document)
          return doc && references(doc.project, doc.path, doc.text, offsetAt(doc.text, position))
        },
        provideRenameRange(document, position) {
          const doc = open(document)
          return doc && renameRange(doc.project, doc.path, doc.text, offsetAt(doc.text, position))
        },
        provideRenameEdits(document, position, newName) {
          const doc = open(document)
          return doc && renameEdits(doc.project, doc.path, doc.text, offsetAt(doc.text, position), newName)
        },
        provideDocumentSemanticTokens(document, range, legend) {
          const doc = open(document)
          if (!doc) return undefined
          const components = new Set(doc.project.importsOf(doc.path).map((i) => i.name))
          return tokensOf(doc.text, components)
            .filter((t) => t.line >= range.start.line && t.line <= range.end.line)
            .map((t) => [t.line, t.character, t.length, legend.tokenTypes.indexOf(TOKEN_TYPES[t.type]!), 0])
        },
      }
    },
  }
}
