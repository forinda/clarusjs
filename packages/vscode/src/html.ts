// Hover and completion for the HTML of a .tscl file, from VS Code's own HTML language service, with clarusjs's
// binding forms of HTML attributes ([prop], (event), [(value)]) and the file's imported components added as tags: each
// one's description says where it comes from, its @input/@model names are its attributes ([name] binds it, [(name)]
// binds a @model two ways), and the CustomEvents its script sends are its (event) bindings. Plain offsets in and out, so the extension
// only converts positions; no VS Code API here.
import { dirname, resolve } from 'node:path'
import { getDefaultHTMLDataProvider, getLanguageService, newHTMLDataProvider, TextDocument, type IAttributeData, type IHTMLDataProvider, type ITagData, type MarkupContent } from 'vscode-html-languageservice'

export type ReadFile = (path: string) => string | undefined
export type HoverResult = { markdown: string; start: number; end: number }
export type CompletionResult = { label: string; /** LSP CompletionItemKind */ kind?: number; insert: string; snippet: boolean; start: number; end: number; documentation?: string }

const IMPORT = /^[ \t]*@import\s+([A-Za-z_$][\w-]*)\s+from\s+(['"])([^'"]+\.tscl)\2/gm
// ponytail: the first line of an input's type only; a multi-line type shows its first line.
const INPUT = /^[ \t]*@(input|model)\s+([A-Za-z_$][\w$]*)\s*:\s*(.+?)(?:\s+=\s+(.*))?\s*$/gm
// ponytail: events a component dispatches, found by their literal name; a name built at runtime isn't listed.
const EVENT = /new\s+CustomEvent\(\s*(['"])([^'"]+)\1/g

const md = (value: string): MarkupContent => ({ kind: 'markdown', value })
const docOf = (d: IAttributeData['description']) => (d === undefined ? '' : typeof d === 'string' ? d : d.value)

/**
 * HTML attributes in their binding forms: `onclick` → `(click)`, any other `x` → `[x]`, and on form fields
 * `[(value)]` / `[(checked)]`. The plain attributes stay HTML's own.
 */
function bindingForms(attributes: IAttributeData[], field: boolean): IAttributeData[] {
  return attributes.flatMap((a) => {
    const doc = docOf(a.description)
    const more = doc ? `\n\n${doc}` : ''
    if (/^on[a-z]/.test(a.name)) {
      const event = a.name.slice(2)
      return [{ name: `(${event})`, description: md(`Event binding: runs the statement on \`${event}\`, with the event as \`$event\`.${more}`) }]
    }
    const forms: IAttributeData[] = [{ name: `[${a.name}]`, description: md(`Property binding: sets \`${a.name}\` from an expression, kept up to date.${more}`) }]
    if (field && (a.name === 'value' || a.name === 'checked')) {
      forms.push({ name: `[(${a.name})]`, description: md(`Two-way binding: shows \`${a.name}\` from a state path and writes the user's changes back to it.${more}`) })
    }
    return forms
  })
}

/** The binding forms of every HTML element's attributes (built once; tags themselves stay HTML's). */
function bindingsProvider(): IHTMLDataProvider {
  const html = getDefaultHTMLDataProvider()
  const globalNames = new Set(html.provideAttributes('cl-no-such-element').map((a) => a.name))
  const globals = bindingForms(html.provideAttributes('cl-no-such-element'), false)
  const byTag = new Map<string, IAttributeData[]>()
  const forTag = (tag: string) => {
    if (!byTag.has(tag)) {
      const own = html.provideAttributes(tag).filter((a) => !globalNames.has(a.name))
      // textarea and select have a value property but no value attribute, so the HTML data doesn't list one.
      const extra = (tag === 'textarea' || tag === 'select') && !own.some((a) => a.name === 'value') ? [{ name: 'value', description: 'The current value.' }] : []
      byTag.set(tag, [...globals, ...bindingForms([...own, ...extra], tag === 'input' || tag === 'textarea' || tag === 'select')])
    }
    return byTag.get(tag)!
  }
  return { getId: () => 'clarusjs-bindings', isApplicable: () => true, provideTags: () => [], provideAttributes: (tag) => forTag(tag.toLowerCase()), provideValues: () => [] }
}

/** The components a file imports, as HTML tags with their inputs as attributes. */
function components(text: string, file: string, read: ReadFile): ITagData[] {
  return [...text.matchAll(IMPORT)].map(([, name, , from]) => {
    // Relative imports are read; package and alias imports are named only.
    const source = from!.startsWith('.') ? read(resolve(dirname(file), from!)) : undefined
    const inputs = source ? [...source.matchAll(INPUT)].map(([, kind, input, type, fallback]) => ({ model: kind === 'model', name: input!, type: type!, optional: fallback !== undefined })) : []
    const events = source ? [...new Set([...source.matchAll(EVENT)].map((m) => m[2]!))] : []
    const lines = inputs.map((i) => `${i.name}${i.optional ? '?' : ''}: ${i.type}`)
    const models = inputs.filter((i) => i.model).map((i) => `\`[(${i.name})]\``)
    const description = [
      `Component from \`${from}\``,
      ...(lines.length ? ['```ts\n' + lines.join('\n') + '\n```'] : source ? ['No inputs.'] : []),
      ...(models.length ? [`Two-way: ${models.join(', ')}`] : []),
      ...(events.length ? [`Events: ${events.map((e) => `\`(${e})\``).join(', ')}`] : []),
    ].join('\n\n')
    const attributes: IAttributeData[] = inputs.flatMap((i): IAttributeData[] => [
      { name: `[${i.name}]`, description: `${i.name}${i.optional ? '?' : ''}: ${i.type}` },
      ...(i.model ? [{ name: `[(${i.name})]`, description: `${i.name}: ${i.type} (two-way: the component writes it back)` }] : []),
    ]).concat(events.map((e) => ({ name: `(${e})`, description: md(`Event from this component: runs the statement when it sends \`${e}\`; its data is \`$event.detail\`.`) })))
    return { name: name!, description: { kind: 'markdown', value: description }, attributes }
  })
}

export function htmlFeatures(read: ReadFile) {
  const service = getLanguageService()
  const bindings = bindingsProvider()
  function prepare(text: string, file: string) {
    service.setDataProviders(true, [bindings, newHTMLDataProvider('clarusjs-components', { version: 1.1, tags: components(text, file, read) })])
    // {{-- comments --}} aren't HTML: blanked (same length, newlines kept), so a tag inside one isn't parsed.
    const html = text.replace(/\{\{--[\s\S]*?--\}\}/g, (c) => c.replace(/[^\n]/g, ' '))
    const document = TextDocument.create(`file://${file}`, 'html', 0, html)
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
