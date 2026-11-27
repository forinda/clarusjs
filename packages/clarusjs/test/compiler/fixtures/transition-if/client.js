import { state, on as __cl_on, escape as __cl_escape, attrHtml as __cl_attrHtml, blockHtml as __cl_blockHtml } from 'clarusjs/runtime'
import { transitionBlock as __cl_tb } from 'clarusjs/motion'

export function attach(__cl_root, __cl_props = {}, __cl_state) {
  const __cl_class = __cl_props.__cl_class ? " " + __cl_props.__cl_class : ""
  const step = state(__cl_state && "step" in __cl_state ? __cl_state.step : 1)

  __cl_on(__cl_root, 0, "click", ($event) => { step.set(step.get() === 1 ? 2 : 1) })
  __cl_tb(__cl_root, 0, () => (step.get() === 1 ? 0 : 1), [
    { html: () => "\n      <p>One</p>\n    ", wire: () => {} },
    { html: () => "\n      <p>Two</p>\n    ", wire: () => {} },
  ], 'slide', ({ mode: 'out-in', duration: { enter: 200, leave: 150 } }))
}
