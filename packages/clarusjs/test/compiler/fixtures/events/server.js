import { escape as __cl_escape, island as __cl_island, attr as __cl_attrHtml, passedHtml as __cl_passedHtml, regionHtml as __cl_regionHtml, sync as __cl_sync, passed as __cl_passed } from 'clarusjs/runtime/server'
import { render as __cl_render_step$counter } from '/src/components/step-counter.tscl'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  if (__cl_slots !== undefined) throw new Error("[clarusjs] <events> does not accept children yet")
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  const __cl_attrs = __cl_passed(__cl_props, [])
  let total = (0)
  let locked = (false)
  return __cl_island("events", "/src/components/events.tscl?import", { ...(__cl_opts?.class && { __cl_class: __cl_opts.class }) }, "<div" + __cl_passedHtml(__cl_attrs, []) + __cl_attrHtml("style", (__cl_attrs.style)) + __cl_attrHtml("class", ["cl-c-events-x78cy", (__cl_class)].join("")) + ">\n  " + __cl_regionHtml(0, () => __cl_sync(__cl_render_step$counter({ value: total }), "step-counter", "events")) + "\n  <p>" + "<!--[0-->" + __cl_escape(total) + "<!--]-->" + "</p>\n</div>", { total, locked }, __cl_opts?.attach, __cl_opts?.paths)
}
