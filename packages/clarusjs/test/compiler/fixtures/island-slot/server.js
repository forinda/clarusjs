import { escape as __cl_escape, island as __cl_island, attr as __cl_attrHtml, passedHtml as __cl_passedHtml, slot as __cl_slot, join as __cl_join, passed as __cl_passed } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (!["head","default"].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <island-slot> has no <slot /> for the content passed to it" : "[clarusjs] <island-slot> has no slot \"" + __cl_k + '"')
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  const __cl_attrs = __cl_passed(__cl_props, [])
  const __cl_cx = __cl_opts?.cx
  let open = (false)
  return __cl_island("island-slot", "/src/components/island-slot.tscl?import", { ...(__cl_opts?.class && { __cl_class: __cl_opts.class }) }, __cl_join(["<section", __cl_passedHtml(__cl_attrs, ["style","class"]), __cl_attrHtml("style", (__cl_attrs.style)), __cl_attrHtml("class", ["cl-c-island-slot-193l4e7", (__cl_class)].join("")), ">\n  <button data-cl-e=\"0\">", "<!--[0-->" + __cl_escape(open ? 'Less' : 'More') + "<!--]-->", "</button>\n  <header>", __cl_join(["<!--[s-->", __cl_slot(__cl_slots?.["head"], undefined, () => "", __cl_cx), "<!--]s-->"]), "</header>\n  <div", __cl_attrHtml("hidden", (!open)), " data-cl-a=\"0\">", __cl_join(["<!--[s-->", __cl_slot(__cl_slots?.["default"], undefined, () => "", __cl_cx), "<!--]s-->"]), "</div>\n</section>"]), { open }, __cl_opts?.attach, __cl_opts?.paths)
}
