import { escape as __cl_escape, attr as __cl_attrHtml, join as __cl_join } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (!["title","default"].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <slots> has no <slot /> for the content passed to it" : "[clarusjs] <slots> has no slot \"" + __cl_k + '"')
  if (__cl_opts?.attach) throw new Error("[clarusjs] <slots> has no <script>, so attach=\"" + __cl_opts.attach + '" does nothing')
  const { heading } = __cl_props
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  return __cl_join(["<article", __cl_attrHtml("class", ["card cl-c-slots-1bssht4", (__cl_class)].join("")), ">\n  <header>", (__cl_slots?.["title"] ?? ""), "</header>\n  <h3>", __cl_escape(heading), "</h3>\n  ", (__cl_slots?.["default"] ?? ""), "\n</article>"])
}
