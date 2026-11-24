import { escape as __cl_escape, attr as __cl_attrHtml, passedHtml as __cl_passedHtml, slot as __cl_slot, join as __cl_join, passed as __cl_passed } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (!["row","empty"].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <scoped-slots> has no <slot /> for the content passed to it" : "[clarusjs] <scoped-slots> has no slot \"" + __cl_k + '"')
  if (__cl_opts?.attach) throw new Error("[clarusjs] <scoped-slots> has no <script>, so attach=\"" + __cl_opts.attach + '" does nothing')
  const { rows } = __cl_props
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  const __cl_attrs = __cl_passed(__cl_props, ["rows"])
  return __cl_join(["<ul", __cl_passedHtml(__cl_attrs, []), __cl_attrHtml("style", (__cl_attrs.style)), __cl_attrHtml("class", ["cl-c-scoped-slots-vuixhd", (__cl_class)].join("")), ">\n  ", ((__cl_l) => __cl_l.length ? __cl_join(__cl_l.map((r, $index) => __cl_join(["\n    <li>", __cl_slot(__cl_slots?.["row"], { item: r, index: $index }, () => __cl_escape(r.name)), "</li>\n  "]))) : (__cl_join(["\n    <li>", __cl_slot(__cl_slots?.["empty"], undefined, () => "Nothing here."), "</li>\n  "])))([...(rows ?? [])]), "\n</ul>"])
}
