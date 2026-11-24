---
'clarusjs': minor
---

Attributes on a component land on its root element (#463). `<item-list id="steps" aria-label="Steps" data-test="x" [aria-controls]="panel" />` renders them on the component's single top-level element (or passes them on to a component there). Attribute-like names only (`id`, `role`, `tabindex`, `hidden`, `lang`, `dir`, `style`, `data-*`, `aria-*`) that the component doesn't declare as inputs; the root's own attribute wins, except `style` and ARIA id lists (`aria-describedby`, `aria-labelledby`, `aria-controls`, `aria-owns`), which merge. Server HTML only: no JavaScript ships. `clarusjs check` accepts these names on a component tag and still reports others. Also: `name="text {{ expr }}"` on a component tag passes the text as a prop.
