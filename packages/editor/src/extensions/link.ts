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
      let { from, to } = state.selection
      const type = schema.marks.link!
      // just a caret: the whole link it's in
      if (from === to) {
        const { parent, parentOffset } = state.selection.$from
        const start = from - parentOffset
        let pos = start
        let run: [number, number] | undefined
        parent.forEach((child) => {
          const end = pos + child.nodeSize
          if (type.isInSet(child.marks)) run = run && run[1] === pos ? [run[0], end] : !run || run[1] < from ? [pos, end] : run
          pos = end
        })
        if (run && run[0] <= from && from <= run[1]) [from, to] = run
      }
      if (!state.doc.rangeHasMark(from, to, type)) return false
      dispatch?.(state.tr.removeMark(from, to, type))
      return true
    },
  }),
})
