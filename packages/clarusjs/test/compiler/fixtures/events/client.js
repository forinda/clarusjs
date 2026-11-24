import { state, holes as __cl_holes, text as __cl_text, region as __cl_region, listen as __cl_listen, escape as __cl_escape, attrHtml as __cl_attrHtml, regionHtml as __cl_regionHtml } from 'clarusjs/runtime'
import { render as __cl_render_step$counter } from '/src/components/step-counter.tscl?render'

export function attach(__cl_root, __cl_props = {}, __cl_state) {
  const __cl_class = __cl_props.__cl_class ? " " + __cl_props.__cl_class : ""
  const __cl_cx = undefined
  const total = state(__cl_state && "total" in __cl_state ? __cl_state.total : 0)
  const locked = state(__cl_state && "locked" in __cl_state ? __cl_state.locked : false)

  const __cl_h = __cl_holes(__cl_root)
  __cl_text(__cl_h[0], () => total.get())
  __cl_region(__cl_root, 0, (__cl_cx) => __cl_render_step$counter({ value: total.get() }, undefined, { cx: __cl_cx }), () => {}, __cl_cx)
  __cl_listen(__cl_root, 0, "change", ($event, $info) => { total.set($event); if (locked.get()) $info.cancel() }, "step-counter")
}
