import { escape as __cl_escape, attr as __cl_attrHtml, styleValue as __cl_styleValue } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (![].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <style-forms> has no <slot /> for the content passed to it" : "[clarusjs] <style-forms> has no slot \"" + __cl_k + '"')
  if (__cl_opts?.attach) throw new Error("[clarusjs] <style-forms> has no <script>, so attach=\"" + __cl_opts.attach + '" does nothing')
  const { hue = 180, big = false } = __cl_props
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  return "<p" + __cl_attrHtml("style", (__cl_styleValue(["margin: 0", { "--hue": (hue) }, { "color": (big ? 'red' : null) }]))) + __cl_attrHtml("class", ["cl-c-style-forms-pn7u4a", (__cl_class)].join("")) + ">Property</p><p" + __cl_attrHtml("style", ({ fontSize: big ? '2em' : null, borderWidth: '1px' })) + __cl_attrHtml("class", ["cl-c-style-forms-pn7u4a", (__cl_class)].join("")) + ">Object</p>"
}
