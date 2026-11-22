import { escape as __cl_escape, attr as __cl_attrHtml, spreadHtml as __cl_spreadHtml, classValue as __cl_classValue, styleValue as __cl_styleValue } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (![].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <spread> has no <slot /> for the content passed to it" : "[clarusjs] <spread> has no slot \"" + __cl_k + '"')
  if (__cl_opts?.attach) throw new Error("[clarusjs] <spread> has no <script>, so attach=\"" + __cl_opts.attach + '" does nothing')
  const { field = {} } = __cl_props
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  return "<input" + __cl_spreadHtml((field), ["style","class"], "input", "src/components/spread.tscl:4:8") + __cl_attrHtml("style", (__cl_styleValue([((field) || {}).style]))) + __cl_attrHtml("class", [(__cl_classValue([((field) || {}).class, "input"])), " cl-c-spread-fjb76g", (__cl_class)].join("")) + ">"
}
