import { state, attr as __cl_attr, batch as __cl_batch, baseUrl as __cl_baseUrl } from 'clarusjs/runtime'

export function attach(__cl_root, __cl_props = {}, __cl_state) {
  const __cl_class = __cl_props.__cl_class ? " " + __cl_props.__cl_class : ""
  const slug = state(__cl_props.slug === undefined ? ('intro') : __cl_props.slug)
  const next = state(__cl_state && "next" in __cl_state ? __cl_state.next : '/guide/next')

  __cl_attr(__cl_root, 0, "href", () => (__cl_baseUrl("/docs/", "href", ["/guide/", (slug.get())].join(''))))
  __cl_attr(__cl_root, 1, "href", () => (__cl_baseUrl("/docs/", "href", (next.get()))))
  return (__cl_p) => __cl_batch(() => {
    slug.set(__cl_p.slug === undefined ? ('intro') : __cl_p.slug)
  })
}
