// Attribute values, shared by server rendering and browser updates so both apply the same rules.

// Attributes whose value is a URL the browser may navigate to or load.
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster', 'cite', 'background', 'xlink:href'])

/**
 * What an attribute should become: `null` removes it, `true` makes it a bare boolean attribute, a string is its value.
 * URL attributes never get a javascript: or vbscript: URL (browsers ignore leading control characters and any tabs or
 * newlines inside the scheme, so those are ignored here too).
 */
export function attrValue(name: string, value: unknown): string | true | null {
  if (value === false || value == null) return null
  if (value === true) return true
  const s = String(value)
  if (URL_ATTRS.has(name.toLowerCase()) && /^(javascript|vbscript):/i.test(s.replace(/[\u0000- ]/g, ''))) return 'about:invalid#unsafe'
  return s
}
