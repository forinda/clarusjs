// The placeholder: attributes on the editable while the document is empty (data-empty, data-placeholder, and
// aria-placeholder for screen readers); @clarusjs/ui's CSS shows it. No decorations, so no view code is imported.
import { Plugin } from 'prosemirror-state'
import type { Node } from 'prosemirror-model'
import { defineExtension, type Extension } from '../core/extension.ts'

const isEmpty = (doc: Node) => doc.childCount === 1 && doc.firstChild!.isTextblock && doc.firstChild!.content.size === 0

/**
 * A placeholder shown while the editor is empty.
 * @example
 * createEditor({ extensions: [...composerExtensions(), placeholder('Reply…')] })
 * @see https://clarusjs.com/guide/editor-composer#extensions
 */
export function placeholder(text: string): Extension {
  return defineExtension({
    name: 'placeholder',
    plugins: () => [new Plugin({
      props: { attributes: (state) => ({ 'aria-placeholder': text, 'data-placeholder': text, ...(isEmpty(state.doc) ? { 'data-empty': '' } : {}) }) },
    })],
  })
}
