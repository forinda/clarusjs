// The extension's code: hover and completion for the HTML in .tscl files (src/html.ts), converted to VS Code's types.
// Expressions and scripts get theirs from TypeScript, through the clarusjs content mapper.
import { readFileSync } from 'node:fs'
import * as vscode from 'vscode'
import { htmlFeatures } from './html.ts'

export function activate(context: vscode.ExtensionContext): void {
  // An open (maybe unsaved) component's text first, then the file on disk.
  const features = htmlFeatures((path) => {
    const open = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === path)
    if (open) return open.getText()
    try { return readFileSync(path, 'utf8') } catch { return undefined }
  })
  const range = (doc: vscode.TextDocument, start: number, end: number) => new vscode.Range(doc.positionAt(start), doc.positionAt(end))
  context.subscriptions.push(
    vscode.languages.registerHoverProvider('tscl', {
      provideHover(doc, position) {
        const hover = features.hover(doc.getText(), doc.uri.fsPath, doc.offsetAt(position))
        return hover ? new vscode.Hover(new vscode.MarkdownString(hover.markdown), range(doc, hover.start, hover.end)) : undefined
      },
    }),
    vscode.languages.registerCompletionItemProvider('tscl', {
      provideCompletionItems(doc, position) {
        return features.complete(doc.getText(), doc.uri.fsPath, doc.offsetAt(position)).map((c) => {
          // LSP kinds are VS Code's plus one.
          const item = new vscode.CompletionItem(c.label, c.kind ? c.kind - 1 : undefined)
          item.insertText = c.snippet ? new vscode.SnippetString(c.insert) : c.insert
          item.range = range(doc, c.start, c.end)
          if (c.documentation) item.documentation = new vscode.MarkdownString(c.documentation)
          return item
        })
      },
    }, '<', ' ', '[', '(', ':', '"', '='),
  )
}

export function deactivate(): void {}
