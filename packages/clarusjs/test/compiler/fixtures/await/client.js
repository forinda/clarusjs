import { state, holes as __cl_holes, text as __cl_text, on as __cl_on, block as __cl_block, awaited as __cl_awaited, escape as __cl_escape, attrHtml as __cl_attrHtml, blockHtml as __cl_blockHtml } from 'clarusjs/runtime'

export function attach(__cl_root, __cl_props = {}, __cl_state) {
  const __cl_class = __cl_props.__cl_class ? " " + __cl_props.__cl_class : ""
  const user = state(__cl_state && "user" in __cl_state ? __cl_state.user : 1)
  const posts = (id) => fetch(`https://jsonplaceholder.typicode.com/posts?userId=${id}`).then((r) => r.json())

  const __cl_a0 = __cl_awaited(() => posts(user.get()))
  __cl_block(__cl_root, 0, () => __cl_a0.k(), [
    { html: () => "\n    <p>Loading…</p>\n  ", wire: () => {} },
    { html: () => ((list) => "\n    <p>" + __cl_escape(list.length) + " posts by user " + "<!--[0-->" + __cl_escape(user.get()) + "<!--]-->" + "</p>\n    <button data-cl-e=\"0\">Next user</button>\n  ")(__cl_a0.v()), wire: () => {
      const list = __cl_a0.v()
      const __cl_h = __cl_holes(__cl_root)
      __cl_text(__cl_h[0], () => user.get())
      __cl_on(__cl_root, 0, "click", ($event) => { user.set(user.get() + 1) })
    } },
    { html: () => ((error) => "\n    <p role=\"alert\">" + __cl_escape(error.message) + "</p>\n  ")(__cl_a0.v()), wire: () => {} },
  ])
}
