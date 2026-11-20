// Attribute values, shared by server rendering and browser updates so both apply the same rules.

// Attributes whose value is a URL (or, for SVG animation, may set one).
const URL_ATTRS = new Set([
  'href', 'src', 'action', 'formaction', 'poster', 'cite', 'background', 'xlink:href',
  'data', 'codebase', 'ping', 'manifest', 'longdesc', 'to', 'from', 'values', 'by',
])
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

/**
 * What an attribute should become: `null` removes it, `true` makes it a bare boolean attribute, a string is its value.
 */
export function attrValue(name: string, value: unknown): string | true | null {
  if (value === false || value == null) return null
  if (value === true) return true
  const s = String(value)
  const n = name.toLowerCase()
  if (n === 'srcset') {
    // "url 1x, url 2x": every candidate's URL must be safe.
    const ok = s.split(',').every((candidate) => safeUrl(candidate.trim().split(/\s+/)[0] ?? '', true))
    return ok ? s : UNSAFE_URL
  }
  if (URL_ATTRS.has(n) && !safeUrl(s, IMAGE_ATTRS.has(n))) return UNSAFE_URL
  return s
}
