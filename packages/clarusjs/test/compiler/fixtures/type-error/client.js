import { state, holes as __cl_holes, text as __cl_text, on as __cl_on, batch as __cl_batch } from 'clarusjs/runtime'

export function attach(__cl_root, __cl_props = {}, __cl_state) {
  const __cl_class = __cl_props.__cl_class ? " " + __cl_props.__cl_class : ""
  const count = state(__cl_props.count)
  const n = state(__cl_state && "n" in __cl_state ? __cl_state.n : 0)

  const __cl_h = __cl_holes(__cl_root)
  __cl_text(__cl_h[0], () => count.get().toUpperCase())
  __cl_text(__cl_h[1], () => n.get())
  __cl_on(__cl_root, 0, "click", ($event) => { n.get().push(1) })
  return (__cl_p) => __cl_batch(() => {
    count.set(__cl_p.count)
  })
}
