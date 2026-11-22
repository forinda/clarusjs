import { state, derived, holes as __cl_holes, text as __cl_text, on as __cl_on, batch as __cl_batch } from 'clarusjs/runtime'

export function attach(__cl_root, __cl_props = {}, __cl_state) {
  const __cl_class = __cl_props.__cl_class ? " " + __cl_props.__cl_class : ""
  const start = state(__cl_props.start === undefined ? (0) : __cl_props.start)
  const count = state(__cl_state && "count" in __cl_state ? __cl_state.count : start.get())
  const double = derived(() => count.get() * 2)
  function add() { count.set(count.get() + 1) }

  const __cl_h = __cl_holes(__cl_root)
  __cl_text(__cl_h[0], () => count.get())
  __cl_text(__cl_h[1], () => double.get())
  __cl_on(__cl_root, 0, "click", ($event) => { add() })
  return (__cl_p) => __cl_batch(() => {
    start.set(__cl_p.start === undefined ? (0) : __cl_p.start)
  })
}
