import { escape as __cl_escape, island as __cl_island, attr as __cl_attrHtml } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (![].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <textarea-value> has no <slot /> for the content passed to it" : "[clarusjs] <textarea-value> has no slot \"" + __cl_k + '"')
  const { start = '' } = __cl_props
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  let note = (start)
  return __cl_island("textarea-value", "/src/components/textarea-value.tscl?import", { start, ...(__cl_opts?.class && { __cl_class: __cl_opts.class }) }, "<label" + __cl_attrHtml("class", ["cl-c-textarea-value-jzpviv", (__cl_class)].join("")) + ">Note <textarea" + __cl_attrHtml("data-cl-path", ("")) + " rows=\"3\"" + "" + " data-cl-a=\"0\" data-cl-e=\"0\">\n" + __cl_escape(note) + "</textarea></label><textarea readonly" + __cl_attrHtml("class", ["cl-c-textarea-value-jzpviv", (__cl_class)].join("")) + "" + " data-cl-a=\"1\">\n" + __cl_escape('Draft: ' + note) + "</textarea>", { note }, __cl_opts?.attach, __cl_opts?.paths)
}
