import { escape as __cl_escape, island as __cl_island, attr as __cl_attrHtml, blockHtml as __cl_blockHtml, forHtml as __cl_forHtml } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (![].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <fragments> has no <slot /> for the content passed to it" : "[clarusjs] <fragments> has no slot \"" + __cl_k + '"')
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  let open = (false)
  const items = (["a", "b"])
  return __cl_island("fragments", "/src/components/fragments.tscl?import", { ...(__cl_opts?.class && { __cl_class: __cl_opts.class }) }, "\n  <button" + __cl_attrHtml("class", ["cl-c-fragments-d0xbdg", (__cl_class)].join("")) + " data-cl-e=\"0\">More</button>\n  " + __cl_blockHtml(0, (open ? 0 : -1), [() => "\n    <p" + __cl_attrHtml("class", ["cl-c-fragments-d0xbdg", (__cl_class)].join("")) + ">One</p><p" + __cl_attrHtml("class", ["cl-c-fragments-d0xbdg", (__cl_class)].join("")) + ">Two</p>\n  "]) + "\n  <dl" + __cl_attrHtml("class", ["cl-c-fragments-d0xbdg", (__cl_class)].join("")) + ">\n    " + __cl_forHtml(0, items, (item, $index) => "\n      <dt>" + "<!--[0-->" + __cl_escape(item) + "<!--]-->" + "</dt><dd>" + "<!--[1-->" + __cl_escape(item.toUpperCase()) + "<!--]-->" + "</dd>\n    ", null) + "\n  </dl>\n", { open, items }, __cl_opts?.attach, __cl_opts?.paths)
}
