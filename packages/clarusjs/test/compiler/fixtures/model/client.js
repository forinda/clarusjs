import { state, holes as __cl_holes, text as __cl_text, on as __cl_on, attr as __cl_attr } from 'clarusjs/runtime'

export function attach(__cl_root, __cl_props = {}, __cl_state) {
  const __cl_class = __cl_props.__cl_class ? " " + __cl_props.__cl_class : ""
  const form = state(__cl_state && "form" in __cl_state ? __cl_state.form : { name: '', plan: 'free', agree: false, size: 1 })

  const __cl_h = __cl_holes(__cl_root)
  __cl_text(__cl_h[0], () => form.get().name)
  __cl_text(__cl_h[1], () => form.get().plan)
  __cl_attr(__cl_root, 0, "value", () => (form.get().name))
  __cl_attr(__cl_root, 1, "value", () => (form.get().size))
  __cl_attr(__cl_root, 2, "value", () => (form.get().plan))
  __cl_attr(__cl_root, 3, "selected", () => (((__cl_s, __cl_v) => (Array.isArray(__cl_s) ? __cl_s.map(String).includes(String(__cl_v)) : String(__cl_s) === String(__cl_v)))(form.get().plan, "free")))
  __cl_attr(__cl_root, 4, "selected", () => (((__cl_s, __cl_v) => (Array.isArray(__cl_s) ? __cl_s.map(String).includes(String(__cl_v)) : String(__cl_s) === String(__cl_v)))(form.get().plan, "pro")))
  __cl_attr(__cl_root, 5, "checked", () => (form.get().agree))
  __cl_on(__cl_root, 0, "input", ($event) => { if (!$event.isComposing) { form.set({ ...form.get(), name: $event.target.value }) } })
  __cl_on(__cl_root, 0, "compositionend", ($event) => { form.set({ ...form.get(), name: $event.target.value }) })
  __cl_on(__cl_root, 1, "input", ($event) => { form.set({ ...form.get(), size: ((__cl_v) => (isNaN(parseFloat(__cl_v)) ? __cl_v : parseFloat(__cl_v)))($event.target.value) }) })
  __cl_on(__cl_root, 2, "change", ($event) => { form.set({ ...form.get(), plan: ($event.target.multiple ? Array.from($event.target.selectedOptions, (__cl_o) => __cl_o.value) : $event.target.value) }) })
  __cl_on(__cl_root, 3, "change", ($event) => { form.set({ ...form.get(), agree: $event.target.checked }) })
}
