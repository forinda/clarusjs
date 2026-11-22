import { state, on as __cl_on, block as __cl_block, escape as __cl_escape, attrHtml as __cl_attrHtml, blockHtml as __cl_blockHtml } from 'clarusjs/runtime'

export function attach(__cl_root, __cl_props = {}, __cl_state) {
  const __cl_class = __cl_props.__cl_class ? " " + __cl_props.__cl_class : ""
  const open = state(__cl_state && "open" in __cl_state ? __cl_state.open : false)

  __cl_on(__cl_root, 0, "click", ($event) => { open.set(!open.get()) })
  __cl_block(__cl_root, 0, () => (open.get() ? 0 : -1), [
    { html: () => "\n  <p" + __cl_attrHtml("class", ["cl-c-icon-1idvb66", (__cl_class)].join("")) + "><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 24 24\" role=\"img\" aria-label=\"Launched\"><path d=\"M4 20 20 4\"/></svg> Launched</p>\n", wire: () => {} },
  ])
}
