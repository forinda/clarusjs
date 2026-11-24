import { escape as __cl_escape, island as __cl_island, attr as __cl_attrHtml, passedHtml as __cl_passedHtml, blockHtml as __cl_blockHtml, passed as __cl_passed } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (![].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <await> has no <slot /> for the content passed to it" : "[clarusjs] <await> has no slot \"" + __cl_k + '"')
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  const __cl_attrs = __cl_passed(__cl_props, [])
  let user = (1)
  const posts = (id) => fetch(`https://jsonplaceholder.typicode.com/posts?userId=${id}`).then((r) => r.json())
  return __cl_island("await", "/src/components/await.tscl?import", { ...(__cl_opts?.class && { __cl_class: __cl_opts.class }) }, "<section" + __cl_passedHtml(__cl_attrs, []) + __cl_attrHtml("style", (__cl_attrs.style)) + __cl_attrHtml("class", ["cl-c-await-1ad8ytd", (__cl_class)].join("")) + ">\n  " + __cl_blockHtml(0, 0, [() => "\n    <p>Loading…</p>\n  "]) + "\n</section>", { user }, __cl_opts?.attach, __cl_opts?.paths)
}
