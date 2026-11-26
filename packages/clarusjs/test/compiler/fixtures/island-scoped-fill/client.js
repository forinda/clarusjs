import { state, on as __cl_on, region as __cl_region, escape as __cl_escape, attrHtml as __cl_attrHtml, regionHtml as __cl_regionHtml } from 'clarusjs/runtime'
import { render as __cl_render_item$list } from '/src/components/item-list.tscl?render'

export function attach(__cl_root, __cl_props = {}, __cl_state) {
  const __cl_class = __cl_props.__cl_class ? " " + __cl_props.__cl_class : ""
  const __cl_cx = undefined
  const rows = state(__cl_state && "rows" in __cl_state ? __cl_state.rows : [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }])
  const mark = state(__cl_state && "mark" in __cl_state ? __cl_state.mark : '-')

  __cl_on(__cl_root, 0, "click", ($event) => { mark.set('+') })
  __cl_region(__cl_root, 0, (__cl_cx) => __cl_render_item$list({ rows: rows.get() }, { "row": ({ item, index }, __cl_cx) => "\n      <b>" + __cl_escape(mark.get()) + __cl_escape(index + 1) + " " + __cl_escape(item.name) + "</b>\n    " }, { cx: __cl_cx }), () => {}, __cl_cx)
}
