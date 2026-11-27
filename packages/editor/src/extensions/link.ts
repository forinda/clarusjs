// Links: an href checked by clarusjs's own URL check whenever it's parsed, set or rendered, so a javascript: URL never
// becomes a link, whether pasted, set by a command, or stored by something else.
import { attrValue, UNSAFE_URL } from 'clarusjs/runtime'
import type { Command } from 'prosemirror-state'
import { defineExtension } from '../core/extension.ts'

const safe = (href: unknown): href is string => typeof href === 'string' && href.trim() !== '' && attrValue('href', href, 'a') !== UNSAFE_URL

/**
 * Links: the commands `link(href)` (refused for a URL that isn't safe, or an empty selection) and `unlink()`.
 * @example
 * editor.run('link', 'https://clarusjs.com')
 * @see https://clarusjs.com/guide/editor-composer#extensions
 */
export const link = defineExtension({
  name: 'link',
  marks: {
    link: {
      attrs: { href: {} },
      inclusive: false,
      parseDOM: [{ tag: 'a[href]', getAttrs: (el) => { const href = (el as HTMLElement).getAttribute('href'); return safe(href) ? { href } : false } }],
      render: (mark) => ['a', { href: attrValue('href', mark.attrs.href, 'a') as string, rel: 'noopener noreferrer nofollow' }, 0],
    },
  },
  commands: (schema) => ({
    link: (href: string): Command => (state, dispatch) => {
      const { from, to, empty } = state.selection
      if (empty || !safe(href)) return false
      dispatch?.(state.tr.addMark(from, to, schema.marks.link!.create({ href })))
      return true
    },
    unlink: (): Command => (state, dispatch) => {
      const { from, to } = state.selection
      if (!state.doc.rangeHasMark(from, to, schema.marks.link!)) return false
      dispatch?.(state.tr.removeMark(from, to, schema.marks.link!))
      return true
    },
  }),
})
