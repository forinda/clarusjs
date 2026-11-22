import { state, holes as __cl_holes, text as __cl_text, on as __cl_on, attr as __cl_attr, block as __cl_block, forBlock as __cl_for, derived as __cl_derived, batch as __cl_batch, escape as __cl_escape, attrHtml as __cl_attrHtml, blockHtml as __cl_blockHtml, forHtml as __cl_forHtml } from 'clarusjs/runtime'

export function attach(__cl_root, __cl_props = {}, __cl_state) {
  const __cl_class = __cl_props.__cl_class ? " " + __cl_props.__cl_class : ""
  const title = state(__cl_props.title === undefined ? ('Items') : __cl_props.title)
  const items = state(__cl_state && "items" in __cl_state ? __cl_state.items : [{ id: 1, name: 'a' }])
  const open = state(__cl_state && "open" in __cl_state ? __cl_state.open : true)

  const __cl_h = __cl_holes(__cl_root)
  __cl_text(__cl_h[0], () => title.get())
  __cl_on(__cl_root, 0, "click", ($event) => { open.set(!open.get()) })
  __cl_block(__cl_root, 0, () => (open.get() ? 0 : 1), [
    { html: () => "\n    <ul>\n      " + __cl_forHtml(0, items.get(), (item, $index, __cl_list, $count = __cl_list.length, $odd = $index % 2 === 1) => "\n        <li" + __cl_attrHtml("class", ($odd ? 'odd' : '')) + " data-cl-a=\"0\">" + "<!--[1-->" + __cl_escape($index) + "<!--]-->" + ": " + "<!--[2-->" + __cl_escape(item.name) + "<!--]-->" + "</li>\n      ", () => "\n        <li>None</li>\n      ") + "\n    </ul>\n  ", wire: () => {
      __cl_for(__cl_root, 0, () => items.get(), (item, $index) => item.id, {
    html: (item, $index, __cl_list, $count = __cl_list.length, $odd = $index % 2 === 1) => "\n        <li" + __cl_attrHtml("class", ($odd ? 'odd' : '')) + " data-cl-a=\"0\">" + "<!--[1-->" + __cl_escape($index) + "<!--]-->" + ": " + "<!--[2-->" + __cl_escape(item.name) + "<!--]-->" + "</li>\n      ",
    wire: (__cl_c1, item, $index, $count) => {
      const $odd = __cl_derived(() => $index.get() % 2 === 1)
      const __cl_h = __cl_holes(__cl_c1)
      __cl_text(__cl_h[1], () => $index.get())
      __cl_text(__cl_h[2], () => item.get().name)
      __cl_attr(__cl_c1, 0, "class", () => ($odd.get() ? 'odd' : ''))
    },
  }, {
    html: () => "\n        <li>None</li>\n      ",
    wire: (__cl_c1) => {},
  })
    } },
    { html: () => "\n    <p>Closed</p>\n  ", wire: () => {} },
  ])
  return (__cl_p) => __cl_batch(() => {
    title.set(__cl_p.title === undefined ? ('Items') : __cl_p.title)
  })
}
