import { state, holes as __cl_holes, text as __cl_text, on as __cl_on, attr as __cl_attr, region as __cl_region, untrack as __cl_untrack, escape as __cl_escape, attrHtml as __cl_attrHtml, regionHtml as __cl_regionHtml } from 'clarusjs/runtime'
import { render as __cl_render_info$card } from '/src/components/info-card.tscl?render'

export function attach(__cl_root, __cl_props = {}, __cl_state) {
  const __cl_class = __cl_props.__cl_class ? " " + __cl_props.__cl_class : ""
  const __cl_cx = undefined
  const email = state(__cl_state && "email" in __cl_state ? __cl_state.email : '')

  __cl_region(__cl_root, 0, (__cl_cx) => __cl_render_info$card({ title: email.get() ? 'Hi' : 'Sign in' }, { "default": (_, __cl_cx) => __cl_untrack(() => "\n  <input" + __cl_attrHtml("data-cl-path", ("")) + __cl_attrHtml("value", (email.get())) + " data-cl-a=\"0\" data-cl-e=\"0\">\n  <p>" + "<!--[1-->" + __cl_escape(email.get().length) + "<!--]-->" + " characters</p>\n  \n"), "footer": (_, __cl_cx) => __cl_untrack(() => "\n    <small>" + "<!--[0-->" + __cl_escape(email.get()) + "<!--]-->" + "</small>\n  ") }, { cx: __cl_cx }), () => {
      const __cl_h = __cl_holes(__cl_root)
      __cl_text(__cl_h[0], () => email.get())
      __cl_text(__cl_h[1], () => email.get().length)
      __cl_attr(__cl_root, 0, "value", () => (email.get()))
      __cl_on(__cl_root, 0, "input", ($event) => { if (!$event.isComposing) { email.set($event.target.value) } })
      __cl_on(__cl_root, 0, "compositionend", ($event) => { email.set($event.target.value) })
    }, __cl_cx)
}
