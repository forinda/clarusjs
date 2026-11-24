import { escape as __cl_escape, island as __cl_island, attr as __cl_attrHtml, passedHtml as __cl_passedHtml, blockHtml as __cl_blockHtml, forHtml as __cl_forHtml, passed as __cl_passed } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  if (__cl_slots !== undefined) throw new Error("[clarusjs] <blocks> does not accept children yet")
  const { title = 'Items' } = __cl_props
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  const __cl_attrs = __cl_passed(__cl_props, ["title"])
  let items = ([{ id: 1, name: 'a' }])
  let open = (true)
  return __cl_island("blocks", "/src/components/blocks.tscl?import", { title, ...(__cl_opts?.class && { __cl_class: __cl_opts.class }) }, "<section" + __cl_passedHtml(__cl_attrs, []) + __cl_attrHtml("style", (__cl_attrs.style)) + __cl_attrHtml("class", ["cl-c-blocks-ae5nuj", (__cl_class)].join("")) + ">\n  <h2>" + "<!--[0-->" + __cl_escape(title) + "<!--]-->" + "</h2>\n  " + __cl_blockHtml(0, (open ? 0 : 1), [() => "\n    <ul>\n      " + __cl_forHtml(0, items, (item, $index, __cl_list, $count = __cl_list.length, $odd = $index % 2 === 1) => "\n        <li" + __cl_attrHtml("class", ($odd ? 'odd' : '')) + " data-cl-a=\"0\">" + "<!--[1-->" + __cl_escape($index) + "<!--]-->" + ": " + "<!--[2-->" + __cl_escape(item.name) + "<!--]-->" + "</li>\n      ", () => "\n        <li>None</li>\n      ") + "\n    </ul>\n  ", () => "\n    <p>Closed</p>\n  "]) + "\n  <button type=\"button\" data-cl-e=\"0\">Toggle</button>\n</section>", { items, open }, __cl_opts?.attach, __cl_opts?.paths)
}
