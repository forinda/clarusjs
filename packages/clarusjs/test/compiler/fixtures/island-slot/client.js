import { state, holes as __cl_holes, text as __cl_text, on as __cl_on, attr as __cl_attr } from 'clarusjs/runtime'

export function attach(__cl_root, __cl_props = {}, __cl_state) {
  const __cl_class = __cl_props.__cl_class ? " " + __cl_props.__cl_class : ""
  const __cl_cx = undefined
  const open = state(__cl_state && "open" in __cl_state ? __cl_state.open : false)

  const __cl_h = __cl_holes(__cl_root)
  __cl_text(__cl_h[0], () => open.get() ? 'Less' : 'More')
  __cl_attr(__cl_root, 0, "hidden", () => (!open.get()))
  __cl_on(__cl_root, 0, "click", ($event) => { open.set(!open.get()) })
}
