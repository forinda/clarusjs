// Event modifiers (#444): (submit.prevent)="…", (keydown.enter)="…", (click.self.once)="…". The name before the
// first dot is the DOM event; each modifier becomes a line of the handler, run before the code as written.

const KEYS: Record<string, string> = {
  enter: 'Enter', esc: 'Escape', escape: 'Escape', space: ' ', tab: 'Tab',
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  delete: 'Delete', backspace: 'Backspace', home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
}
const SYSTEM = ['ctrl', 'shift', 'alt', 'meta']
const KEY_EVENTS = new Set(['keydown', 'keyup', 'keypress'])
const ORDER = ['prevent', 'stop', 'self', 'once']

/** (name.mods): the event type, and its modifiers in the order written. */
export function splitEvent(name: string): { type: string; mods: string[] } {
  const [type, ...mods] = name.split('.')
  return { type: type!, mods }
}

/** Why a modifier list is wrong for this event, or null. */
export function modifierError(type: string, mods: string[]): string | null {
  for (const m of mods) {
    const key = m.toLowerCase()
    if (ORDER.includes(key)) continue
    if (KEYS[key] || SYSTEM.includes(key) || /^[a-z0-9]$/.test(key)) {
      if (!KEY_EVENTS.has(type)) return `.${m} is a key: for (keydown) and (keyup)`
      continue
    }
    return `unknown modifier .${m}: use ${ORDER.join(', ')}, a key (enter, esc, space, tab, up, down, left, right, a letter…) or ctrl, shift, alt, meta`
  }
  return null
}

/**
 * The handler's guard: keys and .self first (an event they don't match does nothing), then .once, .prevent, .stop.
 * `__cl_el` is the element with the handler; `__cl_done` the handler's own .once flag.
 */
export function guardCode(mods: string[]): string {
  const keys = mods.map((m) => m.toLowerCase())
  const tests: string[] = []
  const named = keys.filter((k) => KEYS[k] || /^[a-z0-9]$/.test(k))
  if (named.length) tests.push(`(${named.map((k) => (KEYS[k] ? `$event.key === ${JSON.stringify(KEYS[k])}` : `$event.key?.toLowerCase() === ${JSON.stringify(k)}`)).join(' || ')})`)
  for (const s of SYSTEM) if (keys.includes(s)) tests.push(`$event.${s}Key`)
  if (keys.includes('self')) tests.push('$event.target === __cl_el')
  let code = tests.length ? `if (!(${tests.join(' && ')})) return; ` : ''
  if (keys.includes('once')) code += 'if (__cl_done) return; __cl_done = true; '
  if (keys.includes('prevent')) code += '$event.preventDefault(); '
  if (keys.includes('stop')) code += '$event.stopPropagation(); '
  return code
}
