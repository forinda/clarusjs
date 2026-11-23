import { escape as __cl_escape, island as __cl_island, attr as __cl_attrHtml, classValue as __cl_classValue } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  if (__cl_slots !== undefined) throw new Error("[clarusjs] <class-forms> does not accept children yet")
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  let open = (false)
  let size = ('big')
  return __cl_island("class-forms", "/src/components/class-forms.tscl?import", { ...(__cl_opts?.class && { __cl_class: __cl_opts.class }) }, "<button type=\"button\"" + __cl_attrHtml("class", [(__cl_classValue(["tab", { "open": (open) }])), " cl-c-class-forms-1jlvrdp", (__cl_class)].join("")) + " data-cl-a=\"0\" data-cl-e=\"0\">Toggle</button><p" + __cl_attrHtml("class", [(__cl_classValue(({ shown: open, [size]: true }))), " cl-c-class-forms-1jlvrdp", (__cl_class)].join("")) + " data-cl-a=\"1\">Object</p><p" + __cl_attrHtml("class", [(__cl_classValue((['card', open && 'card-open']))), " cl-c-class-forms-1jlvrdp", (__cl_class)].join("")) + " data-cl-a=\"2\">Array</p><p" + __cl_attrHtml("class", ["note cl-c-class-forms-1jlvrdp", (__cl_class)].join("")) + ">Untouched</p>", { open, size }, __cl_opts?.attach, __cl_opts?.paths)
}
