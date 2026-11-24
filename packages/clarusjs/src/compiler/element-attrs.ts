// The attributes of each element a component may stand for (@extends), with their TypeScript types for check. The
// compiler passes their names through to the root; check types a parent's attributes by them. From the HTML spec's
// attribute lists. ponytail: a fixed set of form, link and media elements; add one when a component needs it.

const B = 'boolean'
const S = 'string'
const N = 'string | number'
const union = (...values: string[]) => values.map((v) => JSON.stringify(v)).join(' | ')

/** Attributes every element takes, beyond what any component's root already takes (id, role, aria-*, data-*…). */
const GLOBAL: Record<string, string> = {
  title: S, accesskey: S, autofocus: B, inert: B, popover: `${union('auto', 'manual', 'hint')} | ''`, spellcheck: `${B} | ${union('true', 'false')}`,
  translate: union('yes', 'no'), draggable: union('true', 'false'), contenteditable: `${B} | ${union('true', 'false', 'plaintext-only')}`,
  enterkeyhint: union('enter', 'done', 'go', 'next', 'previous', 'search', 'send'), inputmode: union('none', 'text', 'decimal', 'numeric', 'tel', 'search', 'email', 'url'),
  autocapitalize: union('off', 'none', 'on', 'sentences', 'words', 'characters'),
}
const FORM_FIELD: Record<string, string> = { disabled: B, form: S, name: S }
const SUBMIT: Record<string, string> = { formaction: S, formenctype: S, formmethod: union('get', 'post', 'dialog'), formnovalidate: B, formtarget: S }

/**
 * Each supported element's own attributes (lowercase names) and their types.
 * @internal The compiler and check read it.
 */
export const ELEMENT_ATTRS: Record<string, Record<string, string>> = {
  button: { ...FORM_FIELD, ...SUBMIT, type: union('submit', 'reset', 'button'), value: N, popovertarget: S, popovertargetaction: union('toggle', 'show', 'hide'), command: S, commandfor: S },
  input: {
    ...FORM_FIELD, ...SUBMIT, type: S, value: N, checked: B, placeholder: S, required: B, readonly: B, multiple: B, min: N, max: N, step: N,
    minlength: N, maxlength: N, pattern: S, size: N, accept: S, alt: S, src: S, width: N, height: N, list: S, autocomplete: S, dirname: S, capture: S,
    popovertarget: S, popovertargetaction: union('toggle', 'show', 'hide'),
  },
  textarea: { ...FORM_FIELD, value: S, placeholder: S, required: B, readonly: B, rows: N, cols: N, minlength: N, maxlength: N, wrap: union('soft', 'hard', 'off'), autocomplete: S, dirname: S },
  select: { ...FORM_FIELD, value: S, required: B, multiple: B, size: N, autocomplete: S },
  option: { disabled: B, label: S, selected: B, value: N },
  a: { href: S, target: S, download: `${S} | ${B}`, rel: S, hreflang: S, type: S, referrerpolicy: S, ping: S },
  img: { src: S, alt: S, srcset: S, sizes: S, width: N, height: N, loading: union('eager', 'lazy'), decoding: union('sync', 'async', 'auto'), fetchpriority: union('high', 'low', 'auto'), crossorigin: S, referrerpolicy: S, usemap: S, ismap: B },
  form: { action: S, method: union('get', 'post', 'dialog'), enctype: S, target: S, novalidate: B, autocomplete: union('on', 'off'), name: S, rel: S, 'accept-charset': S },
  label: { for: S },
  details: { open: B, name: S },
  dialog: { open: B, closedby: union('any', 'closerequest', 'none') },
}

/** The attributes `@extends tag` passes through: the element's and the global ones. */
export function extendedAttrs(tag: string): Record<string, string> {
  return { ...GLOBAL, ...ELEMENT_ATTRS[tag] }
}
