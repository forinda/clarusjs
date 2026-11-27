// createEditor: a ProseMirror view built from extensions, its value a clarusjs signal in the chosen format, with
// Enter to send (never while an input method is composing), a length limit, and commands by name.
import { derived, effect, state, type ReadSignal, type Signal } from 'clarusjs/runtime'
import { baseKeymap, chainCommands, newlineInCode } from 'prosemirror-commands'
import { inputRules } from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import { DOMParser, DOMSerializer, Node, type Schema } from 'prosemirror-model'
import { EditorState, Plugin, Selection, TextSelection, type Command, type PluginSpec } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import type { Extension } from './extension.ts'
import { docLength } from './length.ts'
import { fromText, posAtOffset } from './from-text.ts'
import { buildSchema } from './schema.ts'

/**
 * What `createEditor()` takes.
 * @see https://clarusjs.com/guide/editor-composer#the-core
 */
export type EditorOptions = {
  extensions: Extension[]
  /** How the value is given and emitted: ProseMirror JSON, or HTML. */
  format: 'json' | 'html'
  value?: string | object
  /** Start from plain text instead (a textarea's, with its caret): blank lines make paragraphs. */
  text?: { value: string; caret?: number }
  /** With value: where the cursor starts, as an offset into the value's plain text (a textarea's caret). */
  caret?: number
  editable?: boolean
  /** The editable's accessible name. */
  label?: string
  /** Called with the value when the user sends (Enter, or Mod-Enter); the editor then clears, unless it returns false. */
  onSend?(value: string | object): boolean | void
  /** Enter sends and Shift+Enter is a new line (the default), or Enter is a new line and Mod-Enter sends. */
  enterSends?: boolean
  maxLength?: number
  /** Called with files pasted or dropped in; they don't go into the document. */
  onFiles?(files: File[]): void
}

/**
 * A running editor.
 * @see https://clarusjs.com/guide/editor-composer#the-core
 */
export type Editor = {
  /** The value in the chosen format; setting it replaces the document. */
  value: Signal<string | object>
  /** The length in graphemes, a mention counting as its label. */
  length: ReadSignal<number>
  /** The limit (maxLength), if any, and whether the length is past it. */
  maxLength: number | undefined
  over: ReadSignal<boolean>
  /** The ProseMirror state, after every change (the selection's too): for toolbars. */
  state: ReadSignal<EditorState>
  /** Runs a command by name (`bold`, `link`, `undo`…), with its arguments: false when it can't run. */
  run(name: string, ...args: unknown[]): boolean
  can(name: string, ...args: unknown[]): boolean
  /** Whether a mark or block is active at the selection, by command name (`bold`) or mark or node name (`strong`). */
  active(name: string): boolean
  /** Adds a ProseMirror plugin, before the editor's own (its keys come first); returns how to remove it. */
  addPlugin(spec: PluginSpec<any>): () => void
  focus(): void
  clear(): void
  /** Sends unless empty or over the limit: calls `onSend`, clears (unless it returned false), and returns true. */
  send(): boolean
  destroy(): void
  view: EditorView
  schema: Schema
}

const safari = () => typeof navigator !== 'undefined' && /Apple Computer/.test(navigator.vendor)
/** The same value: the same string, or a JSON document equal to it (a copy a parent passes back through [(value)]). */
const same = (a: unknown, b: unknown) => a === b || (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null && JSON.stringify(a) === JSON.stringify(b))
const ALIASES: Record<string, string> = { bold: 'strong', italic: 'em', codeBlock: 'code_block' }

/**
 * Creates an editor inside `element`.
 * @example
 * const editor = createEditor({ element, extensions: composerExtensions(), format: 'json', onSend: post })
 * effect(() => console.log(editor.length.get()))
 * @see https://clarusjs.com/guide/editor-composer#the-core
 */
export function createEditor(options: EditorOptions & { element: HTMLElement }): Editor {
  const { extensions, format, enterSends = true, maxLength } = options
  const editable = options.editable !== false
  const schema = buildSchema(extensions)
  const commands: Record<string, (...args: any[]) => Command> = Object.assign({}, ...extensions.map((e) => e.commands?.(schema) ?? {}))

  const parse = (value: string | object | undefined): Node => {
    if (value === undefined || value === '') return schema.topNodeType.createAndFill()!
    if (format === 'json') return Node.fromJSON(schema, typeof value === 'string' ? JSON.parse(value) : value)
    // an inert document: nothing in the HTML loads or runs while it's parsed
    const body = document.implementation.createHTMLDocument('').body
    body.innerHTML = String(value)
    return DOMParser.fromSchema(schema).parse(body)
  }
  const serialize = (doc: Node): string | object => {
    if (format === 'json') return doc.toJSON()
    const div = document.createElement('div')
    div.append(DOMSerializer.fromSchema(schema).serializeFragment(doc.content))
    return div.innerHTML
  }
  const isBlank = (doc: Node) => doc.textBetween(0, doc.content.size, '\n', (n) => n.type.spec.leafText?.(n) ?? '').trim() === ''

  const hardBreak: Command = (s, dispatch) => {
    if (!schema.nodes.hard_break) return false
    dispatch?.(s.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView())
    return true
  }
  const newLine = chainCommands(newlineInCode, hardBreak)
  let compositionEnd = 0
  // Enter, with the event in hand: nothing else binds it (baseKeymap's Enter is taken out below).
  const enter = new Plugin({
    props: {
      handleDOMEvents: { compositionend: () => { compositionEnd = Date.now(); return false } },
      handleKeyDown(view, event) {
        if (event.key !== 'Enter') return false
        // an input method confirming a word: not ours (Chrome sends keyCode 229; Safari a plain Enter just after)
        if (event.isComposing || event.keyCode === 229 || view.composing) return false
        // Safari sends a plain Enter right after compositionend; elsewhere (Android) that Enter is the real one
        if (safari() && Date.now() - compositionEnd < 500) { compositionEnd = 0; return true }
        if (event.shiftKey) return newLine(view.state, view.dispatch)
        if (event.ctrlKey || event.metaKey) { send(); return true }
        if (!enterSends || view.state.selection.$from.parent.type.spec.code) return baseKeymap.Enter!(view.state, view.dispatch, view)
        send()
        return true
      },
    },
  })
  const { Enter: _enter, 'Mod-Enter': _modEnter, ...baseKeys } = baseKeymap
  const rules = extensions.flatMap((e) => e.inputRules?.(schema) ?? [])
  const plugins = [
    enter,
    ...(rules.length ? [inputRules({ rules })] : []),
    ...extensions.map((e) => keymap(e.keys?.(schema) ?? {})),
    keymap(baseKeys),
    ...extensions.flatMap((e) => e.plugins?.(schema) ?? []),
  ]

  const start = options.text ? fromText(schema, options.text.value, options.text.caret) : (() => {
    const doc = parse(options.value)
    return { doc, pos: options.caret === undefined ? undefined : posAtOffset(doc, options.caret) }
  })()
  const initial = EditorState.create({
    schema, plugins, doc: start.doc,
    selection: start.pos === undefined ? (options.text ? Selection.atEnd(start.doc) : undefined) : TextSelection.create(start.doc, start.pos),
  })
  let lastEmitted = serialize(initial.doc)
  const value = state<string | object>(lastEmitted)
  const length = state(docLength(initial.doc))
  const current = state(initial)
  const files = (list: FileList | File[] | undefined) => {
    const all = Array.from(list ?? [])
    if (!all.length || !options.onFiles) return false
    options.onFiles(all)
    return true
  }

  const view = new EditorView(options.element, {
    state: initial,
    editable: () => editable,
    attributes: { role: 'textbox', 'aria-multiline': 'true', ...(options.label ? { 'aria-label': options.label } : {}), ...(editable ? {} : { 'aria-readonly': 'true' }) },
    handlePaste: (_view, event) => files(event.clipboardData?.files),
    handleDrop: (_view, event) => files((event as DragEvent).dataTransfer?.files),
    dispatchTransaction(tr) {
      view.updateState(view.state.apply(tr))
      current.set(view.state)
      if (!tr.docChanged) return
      lastEmitted = serialize(view.state.doc)
      length.set(docLength(view.state.doc))
      value.set(lastEmitted)
    },
  })

  const replace = (doc: Node, history = true) => {
    const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content)
    if (!history) tr.setMeta('addToHistory', false)
    view.dispatch(tr)
  }
  // the value set from outside (a parent's [(value)]): the document follows
  const stop = effect(() => {
    const v = value.get()
    if (!same(v, lastEmitted)) replace(parse(v), false)
  })

  const clear = () => replace(schema.topNodeType.createAndFill()!)
  const send = () => {
    const doc = view.state.doc
    if (isBlank(doc) || (maxLength !== undefined && docLength(doc) > maxLength)) return false
    if (options.onSend?.(value.get()) === false) return false
    clear()
    return true
  }
  const command = (name: string, args: unknown[]) => commands[name]?.(...args)

  return {
    value,
    length,
    maxLength,
    over: derived(() => maxLength !== undefined && length.get() > maxLength),
    state: current,
    view,
    schema,
    run: (name, ...args) => command(name, args)?.(view.state, view.dispatch, view) ?? false,
    can: (name, ...args) => command(name, args)?.(view.state) ?? false,
    active(name) {
      const n = ALIASES[name] ?? name
      const { $from, from, to, empty } = view.state.selection
      const mark = schema.marks[n]
      if (mark) return empty ? !!mark.isInSet(view.state.storedMarks ?? $from.marks()) : view.state.doc.rangeHasMark(from, to, mark)
      return schema.nodes[n] ? $from.parent.type === schema.nodes[n] : false
    },
    addPlugin(spec) {
      const plugin = new Plugin(spec)
      view.updateState(view.state.reconfigure({ plugins: [plugin, ...view.state.plugins] }))
      return () => {
        if (!view.isDestroyed) view.updateState(view.state.reconfigure({ plugins: view.state.plugins.filter((p) => p !== plugin) }))
      }
    },
    focus: () => view.focus(),
    clear,
    send,
    destroy() { stop(); view.destroy() },
  }
}
