// HTML attributes in their clarusjs binding forms, as extra HTML data for Volar's HTML service: `onclick` → `(click)`,
// any other `x` → `[x]`, and on form fields `[(value)]` / `[(checked)]`. The plain attributes stay HTML's own.
import { getDefaultHTMLDataProvider, type IAttributeData, type IHTMLDataProvider, type MarkupContent } from 'vscode-html-languageservice'

const md = (value: string): MarkupContent => ({ kind: 'markdown', value })
const docOf = (d: IAttributeData['description']) => (d === undefined ? '' : typeof d === 'string' ? d : d.value)

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

/** The binding forms of every HTML element's attributes (built per tag, once). */
export function bindingsProvider(): IHTMLDataProvider {
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
