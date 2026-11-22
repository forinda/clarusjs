---
'clarusjs': minor
---

Spread attributes onto an element with `[...]="attrs"`. Attributes written on the element win (whatever the order or case), and `class` and `style` merge, the spread's first. Each value is escaped and URL-checked like `[attr]`. Event handlers, `srcdoc`, invalid names, JSX names (`className`, `htmlFor`) and object values are dropped, with a warning naming the place. A spread is refused on elements that load things (`iframe`, `frame`, `embed`, `object`, `base`, `link`, `meta`). In islands it follows state, removing keys that disappear. `{...x}` and dotted names other than `class.` / `style.` are now build errors instead of being written out. An empty `class` or `style` value removes the attribute rather than writing `class=""`.
