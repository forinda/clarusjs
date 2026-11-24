import { escape as __cl_escape, island as __cl_island, attr as __cl_attrHtml, passedHtml as __cl_passedHtml, passed as __cl_passed } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  if (__cl_slots !== undefined) throw new Error("[clarusjs] <counter> does not accept children yet")
  const { start = 0 } = __cl_props
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  const __cl_attrs = __cl_passed(__cl_props, ["start"])
  let count = (start)
  const double = (() => count * 2)()
  function add() { count++ }
  return __cl_island("counter", "/src/components/counter.tscl?import", { start, ...(__cl_opts?.class && { __cl_class: __cl_opts.class }) }, "<button" + __cl_passedHtml(__cl_attrs, []) + __cl_attrHtml("style", (__cl_attrs.style)) + __cl_attrHtml("class", ["cl-c-counter-1f2448z", (__cl_class)].join("")) + " data-cl-e=\"0\">Clicked " + "<!--[0-->" + __cl_escape(count) + "<!--]-->" + " times (double: " + "<!--[1-->" + __cl_escape(double) + "<!--]-->" + ")</button>", { count }, __cl_opts?.attach, __cl_opts?.paths)
}
