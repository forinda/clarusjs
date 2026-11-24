import { escape as __cl_escape, island as __cl_island, attr as __cl_attrHtml } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (![].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <type-error> has no <slot /> for the content passed to it" : "[clarusjs] <type-error> has no slot \"" + __cl_k + '"')
  const { count } = __cl_props
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  let n = (0)
  return __cl_island("type-error", "/src/components/type-error.tscl?import", { count, ...(__cl_opts?.class && { __cl_class: __cl_opts.class }) }, "<p" + __cl_attrHtml("class", ["cl-c-type-error-xizsew", (__cl_class)].join("")) + ">" + "<!--[0-->" + __cl_escape(count.toUpperCase()) + "<!--]-->" + "</p><button" + __cl_attrHtml("class", ["cl-c-type-error-xizsew", (__cl_class)].join("")) + " data-cl-e=\"0\">" + "<!--[1-->" + __cl_escape(n) + "<!--]-->" + "</button>", { n }, __cl_opts?.attach, __cl_opts?.paths)
}
