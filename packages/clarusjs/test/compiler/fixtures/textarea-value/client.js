import { state, on as __cl_on, attr as __cl_attr, batch as __cl_batch } from 'clarusjs/runtime'

export function attach(__cl_root, __cl_props = {}, __cl_state) {
  const __cl_class = __cl_props.__cl_class ? " " + __cl_props.__cl_class : ""
  const start = state(__cl_props.start === undefined ? ('') : __cl_props.start)
  const note = state(__cl_state && "note" in __cl_state ? __cl_state.note : start.get())

  __cl_attr(__cl_root, 0, "value", () => (note.get()))
  __cl_attr(__cl_root, 1, "value", () => ('Draft: ' + note.get()))
  __cl_on(__cl_root, 0, "input", ($event) => { if (!$event.isComposing) { note.set($event.target.value) } })
  __cl_on(__cl_root, 0, "compositionend", ($event) => { note.set($event.target.value) })
  return (__cl_p) => __cl_batch(() => {
    start.set(__cl_p.start === undefined ? ('') : __cl_p.start)
  })
}
