// clarusjs/forms: a headless forms engine. It finds a form's fields by their data-cl-path (written by the compiler
// for every [(value)]/[(checked)]), validates them (native constraints, a Standard Schema, server errors), shows each
// error on its field (its [data-cl-message] message element, aria-invalid, aria-describedby), and keeps nothing on the
// page it doesn't own. A form's values are any state: a component's or a store's.
// @see https://clarusjs.com/guide/form-validation
import { effect, onDispose, state, untrack, type Ctx, type Signal } from '../runtime/index.ts'
import type { Form, FormError, FormOptions, StandardSchema } from './types.ts'

export type { Form, FormError, FormOptions, Path, StandardSchema } from './types.ts'

type Engine<T> = Form<T> & { connect(el: Element): () => void }

const FIELDS = 'input[data-cl-path],select[data-cl-path],textarea[data-cl-path]'
const FLAGS = ['valueMissing', 'typeMismatch', 'patternMismatch', 'tooLong', 'tooShort', 'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput'] as const
let ids = 0

const read = (value: unknown, path: string): unknown => path.split('.').reduce<any>((v, k) => (v == null ? v : v[k]), value)
const dotted = (path: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> = []) =>
  path.map((p) => String(typeof p === 'object' ? p.key : p)).join('.')

/** A field's full path: the data-cl-path values of the elements around it (inside `root`), outermost first. */
function pathOf(field: Element, root: Element): string {
  const parts: string[] = []
  for (let el: Element | null = field; el && el !== root.parentElement; el = el.parentElement) {
    const part = el.getAttribute('data-cl-path')
    if (part) parts.unshift(part)
  }
  return parts.join('.')
}

/** The form's engine. `values`: its state (on the server, where the compiler passes a plain value, it only renders). */
export function form<T extends object>(values: Signal<T> | T, options: FormOptions<T> = {}): Form<T> {
  if (!values || typeof (values as Signal<T>).get !== 'function') return inert<T>()
  const signal = values as Signal<T>
  const initial = untrack(() => signal.get())
  const show = options.show ?? 'blur'
  // What changes the display; error() and friends read `version` so templates follow.
  const version = state(0)
  const pending = state(false)
  const touched = new Set<string>()
  const shownAll = { on: false } // after a submit (or a step check, for its fields: see `forced`)
  const forced = new Set<string>()
  let server: Record<string, string> = {}
  let schemaIssues: Record<string, string> = {}
  let errorsNow: Record<string, string> = {} // path → message, every source, shown or not
  const roots = new Map<Element, number>() // covered element → how many connections
  let checkSeq = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let last = initial
  const current = state('') // the step shown (multi-step forms)
  const passed = new Set<string>() // steps left with next()

  const now = () => untrack(() => current.get())
  /** A field's message element: the first [data-cl-message] in its label, [data-cl-field], fieldset or island. */
  const boxOf = (el: Element) => el.closest('label, [data-cl-field], fieldset, cl-island')?.querySelector<HTMLElement>('[data-cl-message]')
  /** The path of the field an event happened on, if it's one of this form's. */
  const eventPath = (e: Event) => {
    const field = (e.target as Element).closest?.(FIELDS)
    const root = field && [...roots.keys()].find((r) => r.contains(field))
    return field && root ? pathOf(field, root) : undefined
  }
  const fields = () => [...roots.keys()].flatMap((root) => [...root.querySelectorAll(FIELDS)].map((el) => ({ el: el as HTMLInputElement, path: pathOf(el, root) })))
  const shown = (path: string) => shownAll.on || forced.has(path) || (show === 'input' ? touched.has(path) || dirty.has(path) : show === 'blur' && touched.has(path))
  const dirty = new Set<string>()

  /** Recompute every field's error (sources in order of precedence) and put each on its element. */
  function refresh(): void {
    const next: Record<string, string> = {}
    for (const { el, path } of fields()) {
      el.setCustomValidity('')
      let native = ''
      if (!el.validity.valid) {
        const flag = FLAGS.find((f) => el.validity[f])
        native = options.messages?.[path] ?? (flag && options.messages?.[flag]) ?? el.validationMessage
      }
      const message = server[path] || schemaIssues[path] || native || next[path] || ''
      if (message) next[path] = message
      // The browser agrees (and :invalid matches) when the message isn't its own.
      if (server[path] || schemaIssues[path]) el.setCustomValidity(message)
    }
    errorsNow = next
    for (const { el, path } of fields()) paint(el, shown(path) ? errorsNow[path] ?? '' : '')
    version.set(untrack(() => version.get()) + 1)
  }

  /** A field and its message element, as `message` says. */
  function paint(el: HTMLInputElement, message: string): void {
    const box = boxOf(el)
    if (box) {
      if (!box.id) box.id = `cl-msg-${++ids}`
      const described = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
      if (!described.includes(box.id)) el.setAttribute('aria-describedby', [...described, box.id].join(' '))
      box.textContent = message
      box.hidden = !message
    }
    if (message) el.setAttribute('aria-invalid', 'true')
    else el.removeAttribute('aria-invalid')
  }

  /** Run the schema (latest check wins); resolves once its result is applied. */
  function check(): Promise<void> {
    const schema = options.schema
    if (!schema) return Promise.resolve()
    const seq = ++checkSeq
    const apply = (result: Awaited<ReturnType<StandardSchema<T>['~standard']['validate']>>) => {
      if (seq !== checkSeq) return // a newer check started
      schemaIssues = {}
      for (const issue of result.issues ?? []) {
        const path = dotted(issue.path)
        schemaIssues[path] ??= issue.message
      }
      pending.set(false)
      refresh()
    }
    const result = schema['~standard'].validate(untrack(() => signal.get()))
    if (!(result instanceof Promise)) return Promise.resolve(apply(result))
    pending.set(true)
    return result.then(apply)
  }

  // Steps: [data-cl-step][id] sections of the covered form, one shown at a time, the current one in the URL hash.
  const steps = () => [...roots.keys()].flatMap((root) => [...root.querySelectorAll<HTMLElement>('[data-cl-step][id]')])
  function showStep(id: string, push: boolean): void {
    current.set(id)
    for (const step of steps()) {
      step.hidden = step.id !== id
      step.toggleAttribute('data-cl-current', step.id === id)
    }
    if (push && location.hash !== `#${id}`) history.pushState(null, '', `#${id}`) // a history entry, no jump
    refresh()
  }
  /** The step in the URL, if it's one of this form's (another hash, like a heading's, isn't the form's business). */
  const hashStep = () => {
    let id = ''
    try { id = decodeURIComponent(location.hash.slice(1)) } catch {}
    return steps().find((s) => s.id === id)?.id
  }
  const onHash = () => { const id = hashStep(); if (id && id !== now()) showStep(id, false) }
  const go = (id: string) => {
    showStep(id, true)
    const step = steps().find((s) => s.id === id)
    step?.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]')?.focus()
  }
  const errorsIn = (step: Element) => new Set(fields().filter((f) => step.contains(f.el) && shown(f.path) && errorsNow[f.path]).map((f) => f.path)).size
  const checkSoon = () => {
    clearTimeout(timer)
    timer = setTimeout(check, 300)
  }

  // The values changed (a field, or code: a store, reset()): server errors on changed paths go, the schema re-checks.
  effect(() => {
    const value = signal.get()
    untrack(() => {
      for (const path of Object.keys(server)) if (read(value, path) !== read(last, path)) delete server[path]
      last = value
      if (roots.size) { refresh(); checkSoon() }
    })
  })

  const onInput = (e: Event) => {
    const path = eventPath(e)
    if (path === undefined) return
    dirty.add(path)
    refresh()
    checkSoon()
  }
  const onLeave = (e: Event) => {
    const path = eventPath(e)
    if (path === undefined) return
    touched.add(path)
    refresh()
    check()
  }
  const listeners = [['input', onInput], ['change', onInput], ['focusout', onLeave]] as const
  const urlEvents = ['popstate', 'hashchange']

  const engine: Engine<T> = {
    error(path) { version.get(); return shown(path) ? errorsNow[path] ?? '' : '' },
    get errors(): FormError[] {
      version.get()
      const out: FormError[] = []
      for (const { el, path } of fields()) {
        if (out.some((e) => e.path === path) || !shown(path) || !errorsNow[path]) continue
        const box = boxOf(el)
        out.push({ path, message: errorsNow[path]!, id: box?.id || el.id, step: el.closest('[data-cl-step]')?.id ?? null })
      }
      return out
    },
    touched(path) { version.get(); return touched.has(path) },
    changed(path) { return read(signal.get(), path) !== read(initial, path) },
    get valid() { version.get(); return !Object.keys(errorsNow).length && !Object.keys(schemaIssues).length },
    get pending() { return pending.get() },
    setErrors(errors) { server = { ...errors }; for (const path of Object.keys(errors)) forced.add(path); refresh() },
    focus(path) {
      const group = fields().filter((f) => f.path === path).map((f) => f.el)
      const el = group.find((x) => x.checked) ?? group[0]
      const step = el?.closest<HTMLElement>('[data-cl-step][id]')
      if (step?.hidden) showStep(step.id, true) // open the step it's in
      el?.focus()
    },
    get step() { return current.get() },
    get steps() {
      version.get()
      const shownStep = current.get()
      return steps().map((s) => { const errors = errorsIn(s); return { id: s.id, current: s.id === shownStep, done: passed.has(s.id) && !errors, errors } })
    },
    async next() {
      const list = steps()
      const at = list.findIndex((s) => s.id === now())
      const step = list[at]
      if (!step) return false
      const own = fields().filter((f) => step.contains(f.el))
      for (const f of own) forced.add(f.path) // this step's errors show now
      await check()
      refresh()
      const bad = own.find((f) => errorsNow[f.path])
      if (bad) { bad.el.focus(); return false }
      passed.add(step.id)
      if (list[at + 1]) go(list[at + 1]!.id)
      return true
    },
    back() {
      const list = steps()
      const prev = list[list.findIndex((s) => s.id === now()) - 1]
      if (prev) go(prev.id)
    },
    go,
    reset() {
      touched.clear(); dirty.clear(); forced.clear(); server = {}; shownAll.on = false
      signal.set(initial)
      refresh()
    },
    connect(el) {
      // What a connection covers: the <form> around it (or the element itself), once however many connect to it.
      const root = el.closest('form') ?? el
      const count = roots.get(root) ?? 0
      roots.set(root, count + 1)
      if (!count) {
        if (root instanceof HTMLFormElement) root.noValidate = true
        for (const [type, fn] of listeners) root.addEventListener(type, fn)
        if (roots.size === 1) for (const type of urlEvents) addEventListener(type, onHash)
        const list = steps()
        if (list.length) {
          root.setAttribute('data-cl-steps', '')
          showStep(hashStep() || now() || list[0]!.id, false)
        }
        refresh()
        check()
      }
      return () => {
        const left = (roots.get(root) ?? 1) - 1
        if (left) return void roots.set(root, left)
        roots.delete(root)
        for (const [type, fn] of listeners) root.removeEventListener(type, fn)
        if (!roots.size) for (const type of urlEvents) removeEventListener(type, onHash)
      }
    },
  }
  return engine
}

/** [engine]="f" (compiled): connect the element marked data-cl-form="index" to its form until the island goes. */
export function connect(ctx: Ctx, index: number, get: () => Form<any>): void {
  const root = 'root' in ctx ? ctx.root : ctx
  const el = root.matches(`[data-cl-form="${index}"]`) ? root : root.querySelector(`[data-cl-form="${index}"]`)
  const engine = get() as Engine<any>
  if (el && typeof engine.connect === 'function') onDispose(engine.connect(el))
}

/** A form while rendering on the server: nothing to show yet. */
function inert<T>(): Form<T> {
  return {
    error: () => '', errors: [], touched: () => false, changed: () => false, valid: true, pending: false,
    setErrors() {}, focus() {}, reset() {}, step: '', steps: [], next: async () => false, back() {}, go() {},
  }
}
