import { state, on as __cl_on, attr as __cl_attr, classValue as __cl_classValue } from 'clarusjs/runtime'

export function attach(__cl_root, __cl_props = {}, __cl_state) {
  const __cl_class = __cl_props.__cl_class ? " " + __cl_props.__cl_class : ""
  const open = state(__cl_state && "open" in __cl_state ? __cl_state.open : false)
  const size = state(__cl_state && "size" in __cl_state ? __cl_state.size : 'big')

  __cl_attr(__cl_root, 0, "class", () => [(__cl_classValue(["tab", { "open": (open.get()) }])), " cl-c-class-forms-1jlvrdp", (__cl_class)].join(""))
  __cl_attr(__cl_root, 1, "class", () => [(__cl_classValue(({ shown: open.get(), [size.get()]: true }))), " cl-c-class-forms-1jlvrdp", (__cl_class)].join(""))
  __cl_attr(__cl_root, 2, "class", () => [(__cl_classValue((['card', open.get() && 'card-open']))), " cl-c-class-forms-1jlvrdp", (__cl_class)].join(""))
  __cl_on(__cl_root, 0, "click", ($event) => { open.set(!open.get()) })
}
