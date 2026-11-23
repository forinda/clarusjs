import { escape as __cl_escape, attr as __cl_attrHtml } from 'clarusjs/runtime/server'

export async function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (![].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <server-script> has no <slot /> for the content passed to it" : "[clarusjs] <server-script> has no slot \"" + __cl_k + '"')
  if (__cl_opts?.attach) throw new Error("[clarusjs] <server-script> has no <script>, so attach=\"" + __cl_opts.attach + '" does nothing')
  const { limit = 3 } = __cl_props
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  const res = await fetch('https://jsonplaceholder.typicode.com/posts')
  const posts = (await res.json()).slice(0, limit)
  return "<h1" + __cl_attrHtml("class", ["cl-c-server-script-rc081g", (__cl_class)].join("")) + ">Latest posts</h1>" + ((__cl_l) => __cl_l.length ? __cl_l.map((post, $index) => "\n  <h2" + __cl_attrHtml("class", ["cl-c-server-script-rc081g", (__cl_class)].join("")) + ">" + __cl_escape(post.title) + "</h2>\n").join("") : "")([...(posts ?? [])])
}
