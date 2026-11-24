import { state, holes as __cl_holes, text as __cl_text, on as __cl_on, block as __cl_block, forBlock as __cl_for, escape as __cl_escape, attrHtml as __cl_attrHtml, blockHtml as __cl_blockHtml, forHtml as __cl_forHtml } from 'clarusjs/runtime'

export function attach(__cl_root, __cl_props = {}, __cl_state) {
  const __cl_class = __cl_props.__cl_class ? " " + __cl_props.__cl_class : ""
  const open = state(__cl_state && "open" in __cl_state ? __cl_state.open : false)
  const items = state(__cl_state && "items" in __cl_state ? __cl_state.items : ["a", "b"])

  __cl_on(__cl_root, 0, "click", ($event) => { open.set(!open.get()) })
  __cl_block(__cl_root, 0, () => (open.get() ? 0 : -1), [
    { html: () => "\n    <p" + __cl_attrHtml("class", ["cl-c-fragments-d0xbdg", (__cl_class)].join("")) + ">One</p><p" + __cl_attrHtml("class", ["cl-c-fragments-d0xbdg", (__cl_class)].join("")) + ">Two</p>\n  ", wire: () => {} },
  ])
  __cl_for(__cl_root, 0, () => items.get(), (item, $index) => item, {
    html: (item, $index) => "\n      <dt>" + "<!--[0-->" + __cl_escape(item) + "<!--]-->" + "</dt><dd>" + "<!--[1-->" + __cl_escape(item.toUpperCase()) + "<!--]-->" + "</dd>\n    ",
    wire: (__cl_c1, item, $index) => {
      const __cl_h = __cl_holes(__cl_c1)
      __cl_text(__cl_h[0], () => item.get())
      __cl_text(__cl_h[1], () => item.get().toUpperCase())
    },
  }, null)
}
