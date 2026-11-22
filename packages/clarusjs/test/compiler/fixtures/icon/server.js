import { escape as __cl_escape, island as __cl_island, attr as __cl_attrHtml, blockHtml as __cl_blockHtml } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  if (__cl_slots !== undefined) throw new Error("[clarusjs] <icon> does not accept children yet")
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  let open = (false)
  return __cl_island("icon", "/src/components/icon.tscl?import", { ...(__cl_opts?.class && { __cl_class: __cl_opts.class }) }, "<button type=\"button\"" + __cl_attrHtml("class", ["cl-c-icon-1idvb66", (__cl_class)].join("")) + " data-cl-e=\"0\">\n  <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" class=\"glyph\"><path d=\"M4 20 20 4\"/></svg>\n  Launch\n</button>" + __cl_blockHtml(0, (open ? 0 : -1), [() => "\n  <p" + __cl_attrHtml("class", ["cl-c-icon-1idvb66", (__cl_class)].join("")) + "><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1em\" height=\"1em\" viewBox=\"0 0 24 24\" role=\"img\" aria-label=\"Launched\"><path d=\"M4 20 20 4\"/></svg> Launched</p>\n"]), { open }, __cl_opts?.attach, __cl_opts?.paths)
}
