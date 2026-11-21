// The clarusjs service plugin, on the root .tscl document: the compiler's diagnostics (completion, hover, definition,
// references, renames and tokens join it in later stories). The HTML and CSS views are Volar's services'.
import type { LanguageServiceContext, LanguageServicePlugin } from '@volar/language-service'
import { URI } from 'vscode-uri'
import type { Project } from '../project.ts'
import { diagnosticsFor } from './diagnostics.ts'

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
    },
    create(context) {
      return {
        provideDiagnostics(document) {
          if (document.languageId !== 'tscl') return undefined
          const path = URI.parse(sourceUri(context, document.uri)).fsPath
          return diagnosticsFor(projectFor(path), path, document.getText())
        },
      }
    },
  }
}
