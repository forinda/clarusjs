import { escape as __cl_escape, island as __cl_island, attr as __cl_attrHtml, passedHtml as __cl_passedHtml, regionHtml as __cl_regionHtml, sync as __cl_sync, passed as __cl_passed } from 'clarusjs/runtime/server'
import { render as __cl_render_step$counter } from '/src/components/step-counter.tscl'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (![].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <events> has no <slot /> for the content passed to it" : "[clarusjs] <events> has no slot \"" + __cl_k + '"')
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  const __cl_attrs = __cl_passed(__cl_props, [])
  const __cl_cx = __cl_opts?.cx
  let total = (0)
  let locked = (false)
  return __cl_island("events", "/src/components/events.tscl?import", { ...(__cl_opts?.class && { __cl_class: __cl_opts.class }) }, "<div" + __cl_passedHtml(__cl_attrs, []) + __cl_attrHtml("style", (__cl_attrs.style)) + __cl_attrHtml("class", ["cl-c-events-x78cy", (__cl_class)].join("")) + ">\n  " + __cl_regionHtml(0, () => __cl_sync(__cl_render_step$counter({ value: total }, undefined, { cx: __cl_cx }), "step-counter", "events")) + "\n  <p>" + "<!--[0-->" + __cl_escape(total) + "<!--]-->" + "</p>\n</div>", { total, locked }, __cl_opts?.attach, __cl_opts?.paths)
}
