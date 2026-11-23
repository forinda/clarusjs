import { escape as __cl_escape, island as __cl_island, attr as __cl_attrHtml, blockHtml as __cl_blockHtml } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  if (__cl_slots !== undefined) throw new Error("[clarusjs] <await> does not accept children yet")
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  let user = (1)
  const posts = (id) => fetch(`https://jsonplaceholder.typicode.com/posts?userId=${id}`).then((r) => r.json())
  return __cl_island("await", "/src/components/await.tscl?import", { ...(__cl_opts?.class && { __cl_class: __cl_opts.class }) }, "<section" + __cl_attrHtml("class", ["cl-c-await-1ad8ytd", (__cl_class)].join("")) + ">\n  " + __cl_blockHtml(0, 0, [() => "\n    <p>Loading…</p>\n  "]) + "\n</section>", { user }, __cl_opts?.attach, __cl_opts?.paths)
}
