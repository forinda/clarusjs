import { escape as __cl_escape, attr as __cl_attrHtml, passedHtml as __cl_passedHtml, slot as __cl_slot, join as __cl_join, passed as __cl_passed } from 'clarusjs/runtime/server'

export function render(__cl_props = {}, __cl_slots, __cl_opts) {
  for (const __cl_k in __cl_slots) if (!["default"].includes(__cl_k)) throw new Error(__cl_k === "default" ? "[clarusjs] <extends> has no <slot /> for the content passed to it" : "[clarusjs] <extends> has no slot \"" + __cl_k + '"')
  if (__cl_opts?.attach) throw new Error("[clarusjs] <extends> has no <script>, so attach=\"" + __cl_opts.attach + '" does nothing')
  const { variant = "primary" } = __cl_props
  const __cl_class = __cl_opts?.class ? " " + __cl_opts.class : ""
  const __cl_attrs = __cl_passed(__cl_props, ["variant"], ["title","accesskey","autofocus","inert","popover","spellcheck","translate","draggable","contenteditable","enterkeyhint","inputmode","autocapitalize","disabled","form","name","formaction","formenctype","formmethod","formnovalidate","formtarget","type","value","popovertarget","popovertargetaction","command","commandfor"])
  const __cl_cx = __cl_opts?.cx
  return __cl_join(["<button type=\"button\"", __cl_attrHtml("class", ["btn cl-c-extends-s8b4fg", (__cl_class)].join("")), __cl_attrHtml("data-variant", (variant)), __cl_passedHtml(__cl_attrs, ["type","class","data-variant","style"]), __cl_attrHtml("style", (__cl_attrs.style)), ">", __cl_slot(__cl_slots?.["default"], undefined, () => "", __cl_cx), "</button>"])
}
