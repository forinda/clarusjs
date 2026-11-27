import { escape as __cl_escape, island as __cl_island, attr as __cl_attrHtml, passedHtml as __cl_passedHtml, blockHtml as __cl_blockHtml, passed as __cl_passed } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (![].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <transition-if> has no <slot /> for the content passed to it" : "[clarusjs] <transition-if> has no slot \"" + __cl_k + '"')
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  const __cl_attrs = __cl_passed(__cl_props, [])
  let step = (1)
  return __cl_island("transition-if", "/src/components/transition-if.tscl?import", { ...(__cl_opts?.class && { __cl_class: __cl_opts.class }) }, "<section" + __cl_passedHtml(__cl_attrs, ["style","class"]) + __cl_attrHtml("style", (__cl_attrs.style)) + __cl_attrHtml("class", ["cl-c-transition-if-9lsov0", (__cl_class)].join("")) + ">\n  " + __cl_blockHtml(0, (step === 1 ? 0 : 1), [() => "\n      <p>One</p>\n    ", () => "\n      <p>Two</p>\n    "]) + "\n  <button type=\"button\" data-cl-e=\"0\">Next</button>\n</section>", { step }, __cl_opts?.attach, __cl_opts?.paths)
}
