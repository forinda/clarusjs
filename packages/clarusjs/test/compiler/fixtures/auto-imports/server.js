import { escape as __cl_escape, attr as __cl_attrHtml, passedHtml as __cl_passedHtml, join as __cl_join, passed as __cl_passed } from 'clarusjs/runtime/server'
import { render as __cl_render_text$field } from '/src/components/forms/text-field.tscl'
import { render as __cl_render_forms$text$field } from '/src/components/forms/text-field.tscl'
import { render as __cl_render_like$button } from '/src/components/like-button.tscl'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (![].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <auto-imports> has no <slot /> for the content passed to it" : "[clarusjs] <auto-imports> has no slot \"" + __cl_k + '"')
  if (__cl_opts?.attach) throw new Error("[clarusjs] <auto-imports> has no <script>, so attach=\"" + __cl_opts.attach + '" does nothing')
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  const __cl_attrs = __cl_passed(__cl_props, [])
  return __cl_join(["<form", __cl_passedHtml(__cl_attrs, []), __cl_attrHtml("style", (__cl_attrs.style)), __cl_attrHtml("class", ["cl-c-auto-imports-1rvuax9", (__cl_class)].join("")), ">\n  ", __cl_render_text$field({ label: 'Name' }, { "default": "<input name=\"name\">" }), "\n  ", __cl_render_forms$text$field({ label: 'Email' }, { "default": "<input name=\"email\">" }), "\n  ", __cl_render_like$button({  }), "\n  <my-widget></my-widget>\n</form>"])
}
