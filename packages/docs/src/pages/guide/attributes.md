---
title: "Attributes"
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
- `true` adds a boolean attribute; `false`, `null` and `undefined` remove it.
- Inside an interactive component, attributes that read state update when it changes.

## Safety

URL attributes such as `href` and `src` only accept relative URLs and `http:`, `https:`, `mailto:` and `tel:` (plus raster `data:` images for image attributes); anything else becomes `about:invalid#unsafe`. `srcdoc` can't be bound. A bound `style` is escaped but not checked, so don't put untrusted data in it.

::: tip
For events, use `(click)="…"` inside an interactive component, not `onclick`.
:::
