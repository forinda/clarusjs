// Attribute values, shared by server rendering and browser updates so both apply the same rules.

// Attributes whose value is a URL.
const URL_ATTRS = new Set([
  'href', 'src', 'action', 'formaction', 'poster', 'cite', 'background', 'xlink:href',
  'data', 'codebase', 'ping', 'manifest', 'longdesc',
])
// SVG animation values can set an href, but only on animation elements; elsewhere these are ordinary data.
const ANIMATION_ATTRS = new Set(['to', 'from', 'values', 'by'])
const ANIMATION_ELEMENTS = new Set(['animate', 'set', 'animatemotion', 'animatetransform'])
// Attributes that load an image, where a raster data: URL is fine.
const IMAGE_ATTRS = new Set(['src', 'srcset', 'poster'])
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel'])
const RASTER_DATA = /^data:image\/(png|gif|jpe?g|webp|avif|bmp);/i
export const UNSAFE_URL = 'about:invalid#unsafe'

/**
 * Allowlist: a relative URL, a safe scheme, or (for image attributes) a raster data: image.
 * Browsers ignore control characters and whitespace around and inside the scheme, so the check does too.
 */
function safeUrl(url: string, image: boolean): boolean {
  const compact = url.replace(/[\u0000- ]/g, '')
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1]?.toLowerCase()
  if (!scheme) return true // relative: /x, ../x, #x, ?x
  if (SAFE_SCHEMES.has(scheme)) return true
  return image && RASTER_DATA.test(compact)
}

// false is a value here, not a missing attribute: enumerated attributes (removing one means its default), and the
// ARIA states whose absence means "doesn't apply" (no aria-expanded: nothing expands). Other aria-* (aria-current:
// `active ? 'page' : false`) keep false = removed.
const ENUMERATED = new Set(['contenteditable', 'draggable', 'spellcheck', 'translate', 'aria-expanded', 'aria-pressed', 'aria-checked', 'aria-selected'])

/**
 * What an attribute should become: `null` removes it, `true` makes it a bare boolean attribute, a string is its value.
 */
export function attrValue(name: string, value: unknown, tag?: string): string | true | null {
  if (value == null) return null
  const n = name.toLowerCase()
  if (typeof value === 'boolean' && ENUMERATED.has(n)) return n === 'translate' ? (value ? 'yes' : 'no') : String(value) // translate: yes/no
  if (value === false) return null
  if (value === true) return true
  const s = String(value)
  // List-valued URL attributes: every entry must be safe, not just the first.
  if (n === 'srcset') {
    // "url 1x, url 2x"
    const ok = s.split(',').every((candidate) => safeUrl(candidate.trim().split(/\s+/)[0] ?? '', true))
    return ok ? s : UNSAFE_URL
  }
  if (ANIMATION_ATTRS.has(n)) {
    // The compiler passes the tag for these; without one, check them to stay on the safe side.
    if (tag !== undefined && !ANIMATION_ELEMENTS.has(tag.toLowerCase())) return s
    const entries = n === 'values' ? s.split(';') : [s]
    return entries.every((entry) => safeUrl(entry.trim(), false)) ? s : UNSAFE_URL
  }
  if (n === 'ping') return s.split(/\s+/).filter(Boolean).every((url) => safeUrl(url, false)) ? s : UNSAFE_URL
  if (URL_ATTRS.has(n) && !safeUrl(s, IMAGE_ATTRS.has(n))) return UNSAFE_URL
  return s
}
