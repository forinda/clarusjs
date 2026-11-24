import { escape as __cl_escape, attr as __cl_attrHtml, passedHtml as __cl_passedHtml, slot as __cl_slot, join as __cl_join, passed as __cl_passed } from 'clarusjs/runtime/server'
import { render as __cl_render_badge } from './badge.tscl'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (!["default"].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <context> has no <slot /> for the content passed to it" : "[clarusjs] <context> has no slot \"" + __cl_k + '"')
  if (__cl_opts?.attach) throw new Error("[clarusjs] <context> has no <script>, so attach=\"" + __cl_opts.attach + '" does nothing')
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  const __cl_attrs = __cl_passed(__cl_props, [])
  const __cl_cx = __cl_opts?.cx
  const theme = __cl_cx && Object.hasOwn(__cl_cx, "theme") ? __cl_cx.theme : ({ tone: 'light' })
  const group = __cl_cx && Object.hasOwn(__cl_cx, "group") ? __cl_cx.group : (() => { throw new Error("[clarusjs] <context> reads context \"group\", which no component around it provides") })()
  return __cl_join(["<section", __cl_attrHtml("id", (group.id)), __cl_attrHtml("data-tone", (theme.tone)), __cl_passedHtml(__cl_attrs, ["id","data-tone"]), __cl_attrHtml("style", (__cl_attrs.style)), __cl_attrHtml("class", ["cl-c-context-datkwm", (__cl_class)].join("")), ">\n  ", __cl_render_badge({ label: "new" }, undefined, { cx: __cl_cx }), "\n  ", __cl_slot(__cl_slots?.["default"], undefined, () => "", __cl_cx), "\n</section>"])
}
