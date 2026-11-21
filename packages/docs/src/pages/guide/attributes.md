---
title: "Attributes"
group: "Templates"
order: 4
description: "Bind attributes with [name] or {{ }}; values are escaped and URLs are checked."
---

# Attributes

<p class="lead">Bind an attribute with <code verbatim>[name]="expression"</code>, or put <code verbatim>{ }</code> inside an attribute value.</p>

```tscl
<a href="/guide/{{ slug }}" [aria-current]="active ? 'page' : false">{{ label }}</a>
<button [disabled]="saving">Save</button>
```

## Values

- Values are escaped.
- `true` adds a boolean attribute; `false`, `null` and `undefined` remove it. Except where `false` is a value: on the enumerated `spellcheck`, `draggable` and `contenteditable`, and the ARIA states `aria-expanded`, `aria-pressed`, `aria-checked` and `aria-selected`, `true` and `false` become `"true"` and `"false"` (`translate`: `"yes"` and `"no"`). A missing `aria-expanded` would mean nothing expands; `"false"` means it's closed. Other `aria-*` attributes follow the usual rule, so `[aria-current]="active ? 'page' : false"` leaves it off.
- Inside an interactive component, attributes that read state update when it changes.

## Safety

URL attributes such as `href` and `src` only accept relative URLs and `http:`, `https:`, `mailto:` and `tel:` (plus raster `data:` images for image attributes); anything else becomes `about:invalid#unsafe`. A bound `style` is escaped but not checked, so don't put untrusted data in it.

Some attributes load a whole page, plugin, stylesheet or base URL into yours, so a URL from data there could embed anyone's page or restyle your site. These take static values only, and binding them is a build error naming the place:

- `srcdoc`;
- `src` on `<iframe>`, `<frame>` and `<embed>`;
- `data` and `codebase` on `<object>`;
- `href` on `<base>`;
- `sandbox`, `allow` and `referrerpolicy` on `<iframe>`, so data can't loosen what an iframe may do;
- `href` on `<link>`, unless its `rel` is static and loads nothing: `<link rel="canonical" href="{{ url }}">` is fine.

::: tip
For events, use `(click)="…"` inside an interactive component, not `onclick`.
:::
