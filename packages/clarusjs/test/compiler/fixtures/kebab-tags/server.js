import { escape as __cl_escape, attr as __cl_attrHtml, passedHtml as __cl_passedHtml, join as __cl_join, passed as __cl_passed } from 'clarusjs/runtime/server'
import { render as __cl_render_UiBadge } from './ui-badge.tscl'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (![].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <kebab-tags> has no <slot /> for the content passed to it" : "[clarusjs] <kebab-tags> has no slot \"" + __cl_k + '"')
  if (__cl_opts?.attach) throw new Error("[clarusjs] <kebab-tags> has no <script>, so attach=\"" + __cl_opts.attach + '" does nothing')
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  const __cl_attrs = __cl_passed(__cl_props, [])
  const __cl_cx = __cl_opts?.cx
  return __cl_join(["<p", __cl_passedHtml(__cl_attrs, ["style","class"]), __cl_attrHtml("style", (__cl_attrs.style)), __cl_attrHtml("class", ["cl-c-kebab-tags-1bqjh7y", (__cl_class)].join("")), ">\n  Status: ", __cl_render_UiBadge({ tone: "success" }, { "default": (_, __cl_cx) => "live" }, { cx: __cl_cx }), ", also written ", __cl_render_UiBadge({  }, { "default": (_, __cl_cx) => "as imported" }, { cx: __cl_cx }), ".\n</p>"])
}
