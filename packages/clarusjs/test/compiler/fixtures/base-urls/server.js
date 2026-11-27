import { escape as __cl_escape, island as __cl_island, attr as __cl_attrHtml, passedHtml as __cl_passedHtml, baseUrl as __cl_baseUrl, baseAttrs as __cl_baseAttrs, passed as __cl_passed } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (![].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <base-urls> has no <slot /> for the content passed to it" : "[clarusjs] <base-urls> has no slot \"" + __cl_k + '"')
  const { slug = 'intro' } = __cl_props
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  const __cl_attrs = __cl_passed(__cl_props, ["slug"])
  let next = ('/guide/next')
  return __cl_island("base-urls", "/src/components/base-urls.tscl?import", { slug, ...(__cl_opts?.class && { __cl_class: __cl_opts.class }) }, "<nav" + __cl_passedHtml(__cl_baseAttrs("/docs/", __cl_attrs), ["style","class"]) + __cl_attrHtml("style", (__cl_attrs.style)) + __cl_attrHtml("class", ["cl-c-base-urls-hilodd", (__cl_class)].join("")) + ">\n  <a href=\"/docs/guide\">Guide</a>\n  <a" + __cl_attrHtml("href", (__cl_baseUrl("/docs/", "href", ["/guide/", (slug)].join('')))) + " data-cl-a=\"0\">This page</a>\n  <a" + __cl_attrHtml("href", (__cl_baseUrl("/docs/", "href", (next)))) + " data-cl-a=\"1\">Next</a>\n  <a href=\"https://example.com\">Away</a>\n  <img src=\"/docs/logo.svg\" srcset=\"/docs/logo.svg 1x, /docs/logo@2x.svg 2x\" alt=\"\">\n  <span data-href=\"/not-a-link\">/not-a-link</span>\n</nav>", { next }, __cl_opts?.attach, __cl_opts?.paths)
}
