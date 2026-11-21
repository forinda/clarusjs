// Hover and completion for the HTML of a .tscl file, from VS Code's own HTML language service, with the file's
// imported components added as tags: each one's description says where it comes from, and its @input/@model names
// are its attributes ([name] binds it, [(name)] binds a @model two ways). Plain offsets in and out, so the extension
// only converts positions; no VS Code API here.
import { dirname, resolve } from 'node:path'
import { getLanguageService, newHTMLDataProvider, TextDocument, type IAttributeData, type ITagData } from 'vscode-html-languageservice'

export type ReadFile = (path: string) => string | undefined
export type HoverResult = { markdown: string; start: number; end: number }
export type CompletionResult = { label: string; /** LSP CompletionItemKind */ kind?: number; insert: string; snippet: boolean; start: number; end: number; documentation?: string }

const IMPORT = /^@import\s+([A-Za-z_$][\w-]*)\s+from\s+(['"])([^'"]+\.tscl)\2/gm
// ponytail: the first line of an input's type only; a multi-line type shows its first line.
const INPUT = /^@(input|model)\s+([A-Za-z_$][\w$]*)\s*:\s*(.+?)(?:\s+=\s+(.*))?\s*$/gm

/** The components a file imports, as HTML tags with their inputs as attributes. */
function components(text: string, file: string, read: ReadFile): ITagData[] {
  return [...text.matchAll(IMPORT)].map(([, name, , from]) => {
    // Relative imports are read; package and alias imports are named only.
    const source = from!.startsWith('.') ? read(resolve(dirname(file), from!)) : undefined
    const inputs = source ? [...source.matchAll(INPUT)].map(([, kind, input, type, fallback]) => ({ model: kind === 'model', name: input!, type: type!, optional: fallback !== undefined })) : []
    const lines = inputs.map((i) => `${i.name}${i.optional ? '?' : ''}: ${i.type}`)
    const models = inputs.filter((i) => i.model).map((i) => `\`[(${i.name})]\``)
    const description = [
      `Component from \`${from}\``,
      ...(lines.length ? ['```ts\n' + lines.join('\n') + '\n```'] : source ? ['No inputs.'] : []),
      ...(models.length ? [`Two-way: ${models.join(', ')}`] : []),
    ].join('\n\n')
    const attributes: IAttributeData[] = inputs.flatMap((i) => [
      { name: `[${i.name}]`, description: `${i.name}${i.optional ? '?' : ''}: ${i.type}` },
      ...(i.model ? [{ name: `[(${i.name})]`, description: `${i.name}: ${i.type} (two-way: the component writes it back)` }] : []),
    ])
    return { name: name!, description: { kind: 'markdown', value: description }, attributes }
  })
}

export function htmlFeatures(read: ReadFile) {
  const service = getLanguageService()
  function prepare(text: string, file: string) {
    service.setDataProviders(true, [newHTMLDataProvider('clarusjs-components', { version: 1.1, tags: components(text, file, read) })])
    const document = TextDocument.create(`file://${file}`, 'html', 0, text)
    return { document, html: service.parseHTMLDocument(document) }
  }
  return {
    hover(text: string, file: string, offset: number): HoverResult | null {
      const { document, html } = prepare(text, file)
      const hover = service.doHover(document, document.positionAt(offset), html)
      if (!hover || !hover.range) return null
      const c = hover.contents
      const markdown = typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => (typeof x === 'string' ? x : x.value)).join('\n\n') : c.value
      return { markdown, start: document.offsetAt(hover.range.start), end: document.offsetAt(hover.range.end) }
    },
    complete(text: string, file: string, offset: number): CompletionResult[] {
      const { document, html } = prepare(text, file)
      return service.doComplete(document, document.positionAt(offset), html).items.map((item) => {
        const edit = item.textEdit && 'range' in item.textEdit ? item.textEdit : undefined
        const doc = item.documentation
        return {
          label: item.label,
          ...(item.kind ? { kind: item.kind } : {}),
          insert: edit?.newText ?? item.insertText ?? item.label,
          snippet: item.insertTextFormat === 2,
          start: edit ? document.offsetAt(edit.range.start) : offset,
          end: edit ? document.offsetAt(edit.range.end) : offset,
          ...(doc ? { documentation: typeof doc === 'string' ? doc : doc.value } : {}),
        }
      })
    },
  }
}
