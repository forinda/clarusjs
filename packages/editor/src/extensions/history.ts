// Undo and redo.
import { history as historyPlugin, redo, undo } from 'prosemirror-history'
import { defineExtension } from '../core/extension.ts'

/**
 * Undo (Mod-z) and redo (Shift-Mod-z, Mod-y): the commands `undo` and `redo`.
 * @see https://clarusjs.com/guide/editor-composer#extensions
 */
export const history = defineExtension({
  name: 'history',
  plugins: () => [historyPlugin()],
  commands: () => ({ undo: () => undo, redo: () => redo }),
  keys: () => ({ 'Mod-z': undo, 'Shift-Mod-z': redo, 'Mod-y': redo }),
})
