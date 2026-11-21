// clarusjs/forms: a headless forms engine. It finds a form's fields by their data-cl-path (written by the compiler
// for every [(value)]/[(checked)]), validates them (native constraints, a Standard Schema, server errors), shows each
// error on its field (its [data-cl-message] message element, aria-invalid, aria-describedby), and keeps nothing on the
// page it doesn't own. A form's values are any state: a component's or a store's.
// @see https://clarusjs.com/guide/form-validation
import { effect, onDispose, state, untrack, type Ctx, type Signal } from '../runtime/index.ts'
import { marked } from '../runtime/dom.ts'
import { browser } from '../runtime/env.ts'
import type { Form, FormError, FormOptions, StandardSchema } from './types.ts'

export type { Form, FormError, FormOptions, Path, StandardSchema } from './types.ts'

type Engine<T> = Form<T> & { connect(el: Element): () => void }

const CONTAINERS = 'label, [data-cl-field], fieldset, cl-island'
const FIELDS = 'input[data-cl-path],select[data-cl-path],textarea[data-cl-path]'
const FLAGS = ['valueMissing', 'typeMismatch', 'patternMismatch', 'tooLong', 'tooShort', 'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput'] as const
let ids = 0

const read = (value: unknown, path: string): unknown => path.split('.').reduce<any>((v, k) => (v == null ? v : v[k]), value)
const dotted = (path: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> = []) =>
  path.map((p) => String(typeof p === 'object' ? p.key : p)).join('.')

/**
 * A field's full path: the data-cl-path values of the elements around it (inside `root`), outermost first. A part
 * `@name…` is a component's @model `name`: its path is the island's data-cl-path-name (set by the parent binding it),
 * and the walk goes on from that island.
 */
function pathOf(field: Element, root: Element): string {
  const parts: string[] = []
  for (let el: Element | null = field; el && el !== root.parentElement; el = el.parentElement) {
    const here: Element = el
    let part = here.getAttribute('data-cl-path')
    if (part?.startsWith('@')) {
      const [model, ...rest] = part.slice(1).split('.')
      const island: Element | null | undefined = here.parentElement?.closest(`[data-cl-path-${model}]`)
      if (!island) return ''
      part = [island.getAttribute(`data-cl-path-${model}`), ...rest].filter(Boolean).join('.')
      el = island
    }
    if (part) parts.unshift(part)
  }
  return parts.join('.')
}

/** The form's engine. `values`: its state (on the server, where the compiler passes a plain value, it only renders). */
export function form<T extends object>(values: Signal<T> | T, options: FormOptions<T> = {}): Form<T> {
  // On the server (a plain value from the compiler, or a store's signal in a module) it only renders.
  if (!browser || !values || typeof (values as Signal<T>).get !== 'function') return inert<T>()
  const signal = values as Signal<T>
  let initial = untrack(() => signal.get())
  const show = options.show ?? 'blur'
  // What changes the display; error() and friends read `version` so templates follow.
  const version = state(0)
  const pending = state(false)
  // Per field element, not per path: a row removed above shifts paths, and its touched state must not move to the next.
  let touched = new WeakSet<Element>()
  let dirty = new WeakSet<Element>()
  let checked = new WeakSet<Element>() // fields a step check showed
  const shownAll = { on: false } // after a submit
  const forced = new Set<string>() // paths of server errors, shown at once
  let server: Record<string, string> = {}
  let schemaIssues: Record<string, string> = {}
  let errorsNow: Record<string, string> = {} // path → message, every source, shown or not
  const roots = new Map<Element, number>() // covered element → how many connections
  let checkSeq = 0
  let latest: Promise<void> = Promise.resolve()
  let revision = 0 // advances with every change of the values
  let failed = false // the schema threw: nothing is submitted until a check passes
  let timer: ReturnType<typeof setTimeout> | undefined
  let last = initial
  const current = state('') // the step shown (multi-step forms)
  const submitting = state(false)
  const passed = new Set<string>() // steps left with next()

  const now = () => untrack(() => current.get())
  /**
   * A field's message element: the first [data-cl-message] in the nearest container around it (label,
   * [data-cl-field], fieldset, island) that has one, if that container holds no other field (a radio group's share
   * one path, so they share it). Beside the label is best: inside, it's read as the field's name.
   */
  const boxOf = (el: Element, path: string, root: Element) => {
    for (let c = el.closest(CONTAINERS); c; c = c.parentElement?.closest(CONTAINERS) ?? null) {
      const box = c.querySelector<HTMLElement>('[data-cl-message]')
      if (!box) continue
      return [...c.querySelectorAll(FIELDS)].every((x) => x === el || pathOf(x, root) === path) ? box : undefined
    }
  }
  /** The path of the field an event happened on, if it's one of this form's. */
  const eventField = (e: Event) => {
    const field = (e.target as Element).closest?.(FIELDS)
    return field && [...roots.keys()].some((r) => r.contains(field)) ? field : undefined
  }
  const fields = () => [...roots.keys()].flatMap((root) => [...root.querySelectorAll(FIELDS)].map((el) => ({ el: el as HTMLInputElement, path: pathOf(el, root), root })))
  /** Is this field's error shown (by the show rule, or because a step check or a submit showed it)? */
  const shownField = (el: Element, path: string) =>
    shownAll.on || forced.has(path) || checked.has(el) || (show === 'input' ? touched.has(el) || dirty.has(el) : show === 'blur' && touched.has(el))
  const shown = (path: string) => shownAll.on || forced.has(path) || fields().some((f) => f.path === path && shownField(f.el, path))

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
    // Errors on paths no field shows (a whole-object rule, a server error by another name) still count, and list.
    for (const path of new Set([...Object.keys(schemaIssues), ...Object.keys(server)])) next[path] ??= server[path] || schemaIssues[path]!
    if (failed) next[''] ??= options.messages?.schema ?? "The form couldn't be checked. Try again."
    errorsNow = next
    // ponytail: shown() scans the fields per field (quadratic); fine for forms, a per-refresh set if it ever isn't.
    for (const { el, path, root } of fields()) paint(el, boxOf(el, path, root), shown(path) ? errorsNow[path] ?? '' : '')
    version.set(untrack(() => version.get()) + 1)
  }

  /** A field and its message element, as `message` says. */
  function paint(el: HTMLInputElement, box: HTMLElement | undefined, message: string): void {
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
    if (!schema) return (latest = Promise.resolve())
    const seq = ++checkSeq
    const apply = (result: Awaited<ReturnType<StandardSchema<T>['~standard']['validate']>>) => {
      if (seq !== checkSeq) return // a newer check started
      schemaIssues = {}
      failed = false
      for (const issue of result.issues ?? []) {
        const path = dotted(issue.path)
        schemaIssues[path] ??= issue.message
      }
      pending.set(false)
      refresh()
    }
    const result = schema['~standard'].validate(untrack(() => signal.get()))
    if (!(result instanceof Promise)) return (latest = Promise.resolve(apply(result)))
    pending.set(true)
    // A schema that fails keeps its last issues: it's a bug to fix, not a reason to let anything through.
    return (latest = result.then(apply, (err) => {
      if (seq === checkSeq) { pending.set(false); failed = true; refresh() }
      console.error('[clarusjs] the form schema failed', err)
    }))
  }
  /** A check of the current values, done: a pending pause is cut short, and values changed meanwhile checked again. */
  async function settle(): Promise<void> {
    for (;;) {
      clearTimeout(timer)
      const start = revision
      const p = check()
      await p
      if (p === latest && revision === start) return
    }
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
  const onHash = () => {
    // No hash: the entry the page loaded on, before any step was pushed: the first step.
    const id = hashStep() ?? (location.hash.length > 1 ? undefined : steps()[0]?.id)
    if (id && id !== now()) showStep(id, false)
  }
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
      revision++
      if (roots.size) { refresh(); checkSoon() }
    })
  })

  const onInput = (e: Event) => {
    const field = eventField(e)
    if (!field) return
    dirty.add(field)
    revision++
    refresh()
    checkSoon()
  }
  const onLeave = (e: Event) => {
    const field = eventField(e)
    if (!field) return
    touched.add(field)
    refresh()
    check()
  }
  const onSubmit = (e: Event) => { e.preventDefault(); void engine.submit() } // never a page reload
  const listeners = [['input', onInput], ['change', onInput], ['focusout', onLeave], ['submit', onSubmit]] as const
  /** Go to the first error (document order): its step, its field. */
  const toFirstError = () => {
    const first = fields().find((f) => errorsNow[f.path])
    if (first) engine.focus(first.path as never)
    return !Object.keys(errorsNow).length // errors with no field count too
  }
  const urlEvents = ['popstate', 'hashchange']

  const engine: Engine<T> = {
    error(path) { version.get(); return shown(path) ? errorsNow[path] ?? '' : '' },
    get errors(): FormError<T>[] {
      version.get()
      const out: FormError[] = []
      const all = fields()
      for (const { el, path, root } of all) {
        if (out.some((e) => e.path === path) || !shown(path) || !errorsNow[path]) continue
        out.push({ path, message: errorsNow[path]!, id: boxOf(el, path, root)?.id || el.id, step: el.closest('[data-cl-step]')?.id ?? null })
      }
      // Errors no field shows, after the rest.
      for (const [path, message] of Object.entries(errorsNow)) {
        if (!all.some((f) => f.path === path) && (shownAll.on || forced.has(path))) out.push({ path, message, id: '', step: null })
      }
      return out as FormError<T>[]
    },
    touched(path) { version.get(); return fields().some((f) => f.path === path && touched.has(f.el)) },
    changed(path) { return read(signal.get(), path) !== read(initial, path) },
    get valid() { version.get(); return !Object.keys(errorsNow).length },
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
      for (const f of fields()) if (step.contains(f.el)) checked.add(f.el) // this step's errors show now
      await settle()
      refresh()
      // The step's fields as they are now: rows may have moved while the check ran.
      const bad = fields().find((f) => step.contains(f.el) && errorsNow[f.path])
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
    get submitting() { return submitting.get() },
    async submit() {
      if (untrack(() => submitting.get())) return false // one at a time, from the first check on
      submitting.set(true)
      try {
        shownAll.on = true // every error shows from now on
        await settle()
        refresh()
        if (!toFirstError()) return false
        const sent = untrack(() => signal.get())
        const answer = await options.submit?.(sent)
        // Errors for values changed while the server answered are about values no longer there: dropped.
        const now = untrack(() => signal.get())
        const errors = Object.entries(answer?.errors ?? {}).filter(([path]) => !path || read(now, path) === read(sent, path))
        if (errors.length) {
          engine.setErrors(Object.fromEntries(errors))
          return toFirstError()
        }
        return true
      } finally {
        submitting.set(false)
      }
    },
    reset(next) {
      if (next !== undefined) initial = next // new values become the starting point
      touched = new WeakSet(); dirty = new WeakSet(); checked = new WeakSet(); forced.clear(); server = {}; shownAll.on = false
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
        if (!roots.size) {
          for (const type of urlEvents) removeEventListener(type, onHash)
          clearTimeout(timer) // nothing left to check
        }
      }
    },
  }
  return engine
}

/** [engine]="f" (compiled): connect the element marked data-cl-form="index" to its form until the island goes. */
export function connect(ctx: Ctx, index: number, get: () => Form<any>): void {
  const el = marked(ctx, `[data-cl-form="${index}"]`)
  const engine = get() as Engine<any>
  if (el && typeof engine.connect === 'function') onDispose(engine.connect(el))
}

/** A form while rendering on the server: nothing to show yet. */
function inert<T>(): Form<T> {
  return {
    error: () => '', errors: [], touched: () => false, changed: () => false, valid: true, pending: false,
    setErrors() {}, focus() {}, reset() {}, step: '', steps: [], next: async () => false, back() {}, go() {},
    submitting: false, submit: async () => false,
  }
}
