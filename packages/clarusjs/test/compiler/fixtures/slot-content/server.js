import { escape as __cl_escape, island as __cl_island, attr as __cl_attrHtml, regionHtml as __cl_regionHtml, sync as __cl_sync } from 'clarusjs/runtime/server'
import { render as __cl_render_info$card } from '/src/components/info-card.tscl'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (![].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <slot-content> has no <slot /> for the content passed to it" : "[clarusjs] <slot-content> has no slot \"" + __cl_k + '"')
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  const __cl_cx = __cl_opts?.cx
  let email = ('')
  return __cl_island("slot-content", "/src/components/slot-content.tscl?import", { ...(__cl_opts?.class && { __cl_class: __cl_opts.class }) }, __cl_regionHtml(0, () => __cl_sync(__cl_render_info$card({ title: email ? 'Hi' : 'Sign in' }, { "default": (_, __cl_cx) => "\n  <input" + __cl_attrHtml("data-cl-path", ("")) + __cl_attrHtml("value", (email)) + " data-cl-a=\"0\" data-cl-e=\"0\">\n  <p>" + "<!--[1-->" + __cl_escape(email.length) + "<!--]-->" + " characters</p>\n  \n", "footer": (_, __cl_cx) => "\n    <small>" + "<!--[0-->" + __cl_escape(email) + "<!--]-->" + "</small>\n  " }, { cx: __cl_cx }), "info-card", "slot-content")), { email }, __cl_opts?.attach, __cl_opts?.paths)
}
