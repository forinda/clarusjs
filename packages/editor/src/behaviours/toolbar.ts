// The toolbar behaviour, for [use] on an element holding buttons: each button's data-command names a command it runs
// on the editor. aria-pressed follows what's active at the selection, disabled what can't run there; the toolbar is
// one tab stop, with the arrow keys between its buttons (ui-primitives' rovingFocus).
import { rovingFocus } from '@clarusjs/ui-primitives/roving-focus.js'
import { effect } from 'clarusjs/runtime'
import { editorOf } from './editor.ts'

/**
 * A toolbar for the editor on `options.editor`; returns the dispose. The `link` button asks for an address, or
 * unlinks when a link is selected.
 * @example
 * <div aria-label="Formatting" [use]="(el) => toolbar(el, { editor: field })">
 *   <button type="button" data-command="bold" aria-label="Bold">B</button>
 * </div>
 * @see https://clarusjs.com/guide/editor-composer#behaviours
 */
export function toolbar(el: HTMLElement, options: { editor: Element }): () => void {
  const ed = editorOf(options.editor)
  if (!ed) throw new Error('@clarusjs/editor: toolbar() needs the element the editor behaviour runs on')
  if (!el.hasAttribute('role')) el.setAttribute('role', 'toolbar')
  const buttons = () => [...el.querySelectorAll<HTMLButtonElement>('button[data-command]')]
  const stopRoving = rovingFocus(el, { orientation: 'horizontal' })

  // keep the editor's selection (and focus) while a button is pressed
  const down = (e: MouseEvent) => { if ((e.target as Element).closest('button[data-command]')) e.preventDefault() }
  const click = (e: MouseEvent) => {
    const button = (e.target as Element).closest<HTMLButtonElement>('button[data-command]')
    if (!button || !el.contains(button)) return
    const command = button.dataset.command!
    if (command === 'link') {
      // ponytail: the browser's prompt; a popover with an address field later
      if (ed.active('link')) ed.run('unlink')
      else {
        const href = prompt('Link address')
        if (href) ed.run('link', href.trim())
      }
    } else ed.run(command)
    ed.focus()
  }
  el.addEventListener('mousedown', down)
  el.addEventListener('click', click)

  const stop = effect(() => {
    ed.state.get()
    for (const b of buttons()) {
      const command = b.dataset.command!
      b.setAttribute('aria-pressed', String(ed.active(command)))
      if (command !== 'link') b.disabled = !ed.can(command)
    }
  })

  return () => {
    stop()
    stopRoving()
    el.removeEventListener('mousedown', down)
    el.removeEventListener('click', click)
  }
}
