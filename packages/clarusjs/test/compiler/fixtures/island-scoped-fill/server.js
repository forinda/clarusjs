import { escape as __cl_escape, island as __cl_island, attr as __cl_attrHtml, passedHtml as __cl_passedHtml, regionHtml as __cl_regionHtml, sync as __cl_sync, passed as __cl_passed } from 'clarusjs/runtime/server'
import { render as __cl_render_item$list } from '/src/components/item-list.tscl'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (![].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <island-scoped-fill> has no <slot /> for the content passed to it" : "[clarusjs] <island-scoped-fill> has no slot \"" + __cl_k + '"')
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  const __cl_attrs = __cl_passed(__cl_props, [])
  const __cl_cx = __cl_opts?.cx
  let rows = ([{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }])
  let mark = ('-')
  return __cl_island("island-scoped-fill", "/src/components/island-scoped-fill.tscl?import", { ...(__cl_opts?.class && { __cl_class: __cl_opts.class }) }, "<div" + __cl_passedHtml(__cl_attrs, ["style","class"]) + __cl_attrHtml("style", (__cl_attrs.style)) + __cl_attrHtml("class", ["cl-c-island-scoped-fill-tat20v", (__cl_class)].join("")) + ">\n  " + __cl_regionHtml(0, () => __cl_sync(__cl_render_item$list({ rows: rows }, { "row": ({ item, index }, __cl_cx) => "\n      <b>" + __cl_escape(mark) + __cl_escape(index + 1) + " " + __cl_escape(item.name) + "</b>\n    " }, { cx: __cl_cx }), "item-list", "island-scoped-fill")) + "\n  <button data-cl-e=\"0\">mark</button>\n</div>", { rows, mark }, __cl_opts?.attach, __cl_opts?.paths)
}
