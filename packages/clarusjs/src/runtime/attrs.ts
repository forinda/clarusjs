// Attribute values, shared by server rendering and browser updates so both apply the same rules.

// Attributes whose value is a URL.
const URL_ATTRS = new Set([
  'href', 'src', 'action', 'formaction', 'poster', 'cite', 'background', 'xlink:href',
  'data', 'codebase', 'ping', 'manifest', 'longdesc',
])
// SVG animation values can set an href, but only on animation elements; elsewhere these are ordinary data.
const ANIMATION_ATTRS = new Set(['to', 'from', 'values', 'by'])
const ANIMATION_ELEMENTS = new Set(['animate', 'set', 'animatemotion', 'animatetransform'])
// Attributes that load an image, where a raster data: URL or an object URL (blob:, a preview of a picked file) is fine:
// an image can't run script. Attributes that load a page or a script (iframe, embed, object, script) are static only,
// so a bound value never reaches them; href keeps refusing blob: (a blob of HTML would open as this site's page).
const IMAGE_ATTRS = new Set(['src', 'srcset', 'poster'])
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel'])
const RASTER_DATA = /^data:image\/(png|gif|jpe?g|webp|avif|bmp);/i
/**
 * What `attrValue()` puts in place of a URL it refuses (a `javascript:` link, say): an address that goes nowhere.
 * @example
 * attrValue('href', 'javascript:alert(1)') === UNSAFE_URL // true
 * @see https://clarusjs.com/reference/runtime#attrvalue
 */
export const UNSAFE_URL = 'about:invalid#unsafe'

/**
 * Allowlist: a relative URL, a safe scheme, or (for image attributes) a raster data: image or an object URL.
 * Browsers ignore control characters and whitespace around and inside the scheme, so the check does too.
 */
function safeUrl(url: string, image: boolean): boolean {
  const compact = url.replace(/[\u0000- ]/g, '')
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1]?.toLowerCase()
  if (!scheme) return true // relative: /x, ../x, #x, ?x
  if (SAFE_SCHEMES.has(scheme)) return true
  return image && (scheme === 'blob' || RASTER_DATA.test(compact))
}

// false is a value here, not a missing attribute: enumerated attributes (removing one means its default), and the
// ARIA states whose absence means "doesn't apply" (no aria-expanded: nothing expands). Other aria-* (aria-current:
// `active ? 'page' : false`) keep false = removed.
const ENUMERATED = new Set(['contenteditable', 'draggable', 'spellcheck', 'translate', 'aria-expanded', 'aria-pressed', 'aria-checked', 'aria-selected'])

/**
 * A class from a string (as written), an object (its truthy keys) or an array (flattened, falsy entries dropped), like
 * clsx. Templates use it for `[class]` values and `[class.name]` toggles.
 * @example
 * classValue(['a', on && 'b', { c: true, d: false }]) // 'a b c' when on
 * @see https://clarusjs.com/guide/attributes
 */
export function classValue(value: unknown): string {
  const names = (v: unknown): unknown[] => (!v ? [] : typeof v === 'string' ? v.split(/\s+/) : Array.isArray(v) ? v.flatMap(names) : typeof v === 'object' ? Object.keys(v).filter((k) => (v as Record<string, unknown>)[k]) : [String(v)])
  // Each class once, single spaces: a written class="star" and a bound 'star on' make "star on".
  return [...new Set(names(value).filter(Boolean))].join(' ')
}

/**
 * A style from a string (as written), an object (camelCase keys to kebab-case, custom properties as they are; null,
 * undefined, false and '' left out; no units added) or an array of those. Templates use it for `[style]` values and
 * `[style.prop]` bindings.
 * @example
 * styleValue({ fontSize: '2em', '--accent': c, color: null }) // 'font-size: 2em; --accent: …;'
 * @see https://clarusjs.com/guide/attributes
 */
export function styleValue(value: unknown): string {
  // A string stays whole (a url(data:…;base64,…) holds a ';'); only a trailing ';' is dropped before joining.
  const decls = (v: unknown): string[] =>
    !v ? [] : typeof v === 'string' ? [v.trim().replace(/;\s*$/, '')].filter(Boolean) : Array.isArray(v) ? v.flatMap(decls) : typeof v === 'object'
      ? Object.entries(v).filter(([, x]) => x != null && x !== false && x !== '').map(([k, x]) => `${k.startsWith('--') ? k : k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}: ${x}`)
      : []
  return decls(value).map((d) => d + ';').join(' ')
}

/**
 * What an attribute should become: `null` removes it, `true` makes it a bare boolean attribute, a string is its value.
 * URL attributes (`href`, `src`…) are checked: a relative URL or a safe scheme passes, anything else becomes
 * `UNSAFE_URL`. The same check templates use, for packages that write attributes themselves (`@clarusjs/editor`).
 * @example
 * attrValue('href', '/docs') // '/docs'
 * attrValue('href', 'javascript:alert(1)') // UNSAFE_URL
 * attrValue('disabled', true) // true
 * @see https://clarusjs.com/reference/runtime#attrvalue
 */
export function attrValue(name: string, value: unknown, tag?: string): string | true | null {
  if (value == null) return null
  const n = name.toLowerCase()
  // A class from an object or an array (a spread's class, or one bound directly): its classes, never [object Object].
  if (n === 'class' && typeof value === 'object') return classValue(value) || null
  if (n === 'style' && typeof value === 'object') return styleValue(value) || null
  // An empty class or style adds nothing (a spread without one, a class whose toggles are all off).
  if ((n === 'class' || n === 'style') && value === '') return null
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

// Attributes whose URL a site's base applies to (Vite's base: a site at /docs/), for the compiler and h().
const BASE_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster', 'cite', 'data', 'xlink:href'])
const rooted = (u: string) => u.startsWith('/') && !u.startsWith('//')
/** Whether a site's base applies to this attribute's URL (srcset included). @internal The compiler asks. */
export const isBaseAttr = (name: string): boolean => BASE_ATTRS.has(name.toLowerCase()) || name.toLowerCase() === 'srcset'

/**
 * A URL attribute's value with the site's base: a root-relative URL (one `/`) gets it, once (paths are written
 * without it); `srcset` gets it on each candidate. Anything else (another attribute, a full or `//` URL, `#`, `?`, a
 * relative path, a value that isn't a string) is returned as it is, and base `/` changes nothing.
 * @internal The compiler and h() call this; apps use `withBase()` from clarusjs/navigation.
 */
export function baseUrl(base: string, name: string, value: unknown): unknown {
  if (base === '/' || typeof value !== 'string') return value
  const n = name.toLowerCase()
  const prefix = base.replace(/\/$/, '')
  if (BASE_ATTRS.has(n)) return rooted(value) ? prefix + value : value
  if (n !== 'srcset') return value
  // As HTML reads a srcset: a URL runs to the next whitespace (commas inside it stay), commas at its end part two
  // candidates, and its descriptors (1x, 640w) run to the next comma.
  let out = ''
  for (let i = 0; i < value.length;) {
    let j = i
    while (j < value.length && /[\s,]/.test(value[j]!)) j++
    out += value.slice(i, j)
    if ((i = j) >= value.length) break
    while (j < value.length && !/\s/.test(value[j]!)) j++
    let url = value.slice(i, j)
    const commas = /,+$/.exec(url)?.[0] ?? ''
    url = url.slice(0, url.length - commas.length)
    out += (rooted(url) ? prefix + url : url) + commas
    i = j
    if (commas) continue
    while (j < value.length && value[j] !== ',') j++
    out += value.slice(i, j)
    i = j
  }
  return out
}

const ATTR_NAME = /^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/

/**
 * A spread's attributes (#405): each key with its value as attrValue gives it, except the names written on the element
 * (`skip`, lowercase), class and style (merged with the element's own), and what a spread may never set, listed in
 * `dropped` with why: event handlers, srcdoc, invalid names, JSX names and objects or functions.
 * @internal the runtimes call this; apps write [...]="attrs".
 */
export function spreadAttrs(obj: unknown, skip: readonly string[], tag?: string): { set: [string, string | true | null][]; dropped: [string, string][] } {
  const set: [string, string | true | null][] = []
  const dropped: [string, string][] = []
  if (!obj || typeof obj !== 'object') return { set, dropped }
  for (const [key, value] of Object.entries(obj)) {
    const n = key.toLowerCase()
    if (skip.includes(n) || n === 'class' || n === 'style') continue
    const why = !ATTR_NAME.test(key) ? 'not an attribute name'
      // clarusjs's own markers (data-cl-e, data-cl-a, data-cl-path…): data must not spoof the runtime's wiring.
      : n.startsWith('data-cl-') || n.startsWith('cl-') ? 'reserved for clarusjs'
      : n.startsWith('on') ? 'an event handler: use (event)="…" in an island'
      : n === 'srcdoc' ? 'srcdoc is static only'
      : key === 'className' ? 'a JSX name: use class' : key === 'htmlFor' ? 'a JSX name: use for'
      : value !== null && (typeof value === 'object' || typeof value === 'function') ? 'not a value for an attribute (an object or a function)'
      : ''
    if (why) dropped.push([key, why])
    else set.push([key, attrValue(key, value, tag)])
  }
  return { set, dropped }
}

// What a parent's attributes may set on a component's root (#463): attribute-like names only, so a page's load() data or
// a layout's path never become attributes.
const PASSED = /^(id|role|tabindex|hidden|lang|dir|style|(data|aria)-[\w:.-]+)$/

/**
 * The attributes a parent passed to a component (#463): its props with an attribute-like name that it doesn't declare
 * as an input. They land on its root element (a spread, so the root's own attributes win; style merges).
 * @internal Compiled components call this.
 */
export function passed(props: Record<string, unknown>, inputs: readonly string[], element: readonly string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  // Never clarusjs's own markers (data-cl-e, data-cl-u, data-cl-path…): passed data must not spoof the runtime's wiring.
  // element: an @extends component's element attributes (button's disabled, form…), passed through as well.
  for (const k in props) if ((PASSED.test(k) || element.includes(k.toLowerCase())) && !/^data-cl-/i.test(k) && !inputs.includes(k)) out[k] = props[k]
  return out
}
