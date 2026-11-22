---
title: "Attributes"
group: "Templates"
order: 4
description: "Bind attributes, classes and styles: [name], {{ }} in values, [class.name], object and array classes, [style.prop], style objects, and spreading attributes with [...]. What works, what doesn't, and why."
---

# Attributes

<p class="lead">Bind an attribute with <code verbatim>[name]="expression"</code>, put <code verbatim>{{ }}</code> inside a value, toggle classes and style properties one by one, or spread a whole object of attributes with <code>[...]</code>.</p>

<attrDemo />

```tscl
<button
  type="button"
  [class.on]="on"
  [style.--hue]="hue"
  [...]="{ 'aria-pressed': String(on), title: on ? 'On' : 'Off' }"
  (click)="on = !on"
>
  {{ on ? 'On' : 'Off' }}
</button>
```

## One attribute

```tscl
<a href="/guide/{{ slug }}" [aria-current]="active ? 'page' : false">{{ label }}</a>
<button [disabled]="saving">Save</button>
```

- `[name]="expression"` binds the whole value; `{{ }}` inside a written value binds part of it.
- Values are escaped.
- `true` adds a boolean attribute; `false`, `null` and `undefined` remove it. Except where `false` is a value: on the enumerated `spellcheck`, `draggable` and `contenteditable`, and the ARIA states `aria-expanded`, `aria-pressed`, `aria-checked` and `aria-selected`, `true` and `false` become `"true"` and `"false"` (`translate`: `"yes"` and `"no"`). A missing `aria-expanded` would mean nothing expands; `"false"` means it's closed. Other `aria-*` attributes follow the usual rule, so `[aria-current]="active ? 'page' : false"` leaves it off.
- Inside an interactive component, attributes that read state update when it changes.

## Class

Toggle one class with `[class.name]`, or bind `[class]` to a string, an object or an array:

```tscl
<li class="tab" [class.active]="current === id">…</li>
<p [class]="{ error: failed, muted: !failed }">…</p>
<p [class]="['card', size, wide && 'card-wide']">…</p>
```

- An object adds its keys whose values are truthy; an array adds its entries, leaving out `false`, `null`, `undefined`, `0` and `''`, and may hold strings, objects and arrays (as [clsx](https://github.com/lukeed/clsx) does).
- Every class source on an element merges: `class="…"`, `{{ }}` in it, `[class]`, the toggles (last) and the component's scope class. Each class appears once, so `class="star" [class]="hover ? 'star on' : 'star'"` is `star on`.
- An element whose class ends up empty has no `class` attribute.
- In an island the whole `class` attribute is rewritten when state changes: a class an island script adds by hand is gone on the next update, so let the template own `class`.
- A class with characters an attribute name can't hold, like Tailwind's `w-1/2`, can't be a toggle: use the object form, `[class]="{ 'w-1/2': half }"`. `[class.md:flex]` is fine.
- On a component tag, `class` is static only (`<card class="wide" />`): it reaches the component's top-level elements.

## Style

Set one property with `[style.prop]`, or bind `[style]` to an object:

```tscl
<div [style.--accent]="color" [style.width]="progress + '%'">…</div>
<p [style]="{ fontSize: big ? '2em' : null, color: tone }">…</p>
```

- Property names in kebab-case (`[style.font-size]`) or camelCase (`[style.fontSize]`); custom properties (`[style.--accent]`) as written.
- `null`, `undefined` and `false` leave a property out.
- Values are written as they are: no units are added, so `width: 50` is not `50px` (write `'50px'` or `n + 'px'`).
- Written `style="…"`, `[style]` and the properties merge, in that order.

## Spread

`[...]="attrs"` sets every key of an object as an attribute:

```tscl
<input [...]="field" class="input" />
<a [...]="link">{{ label }}</a>
```

- **Written attributes win.** An attribute written on the element is kept, whatever the order or case (`TITLE` in the object loses to `title="…"`). `class` and `style` merge, the spread's first.
- **Same rules as one attribute.** Each value is escaped and URL-checked (`href: 'javascript:…'` becomes `about:invalid#unsafe`); `true`, `false` and `null` work the same.
- **Dropped, with a warning** (in development and at build, naming the place): event handlers (`onclick`: use `(click)` in an island), `srcdoc`, names that aren't attribute names, clarusjs's own markers (`data-cl-…`), JSX names (`className`: use `class`; `htmlFor`: use `for`), and objects or functions as values (write flat keys: `'aria-label'`, `'data-id'`).
- **Refused** on `<iframe>`, `<frame>`, `<embed>`, `<object>`, `<base>`, `<link>` and `<meta>`: a spread could set what they load. Write their attributes one by one.
- **In an island**, a spread that reads state follows it: new and changed keys are set, and keys that disappear are removed (only those it set).
- **One per element.**

On a component tag, `[...]="props"` passes every key as a prop, and props written on the tag win:

```tscl
<card [...]="cardProps" [tone]="'loud'" />
```

`clarusjs check` types it against the component's inputs: the object must provide the required inputs the tag doesn't write, with the right types.

## Safety

URL attributes such as `href` and `src` only accept relative URLs and `http:`, `https:`, `mailto:` and `tel:` (plus raster `data:` images for image attributes); anything else becomes `about:invalid#unsafe`. A bound `style` is escaped but not checked, so don't put untrusted data in it.

Some attributes load a whole page, plugin, stylesheet or base URL into yours, so a URL from data there could embed anyone's page or restyle your site. These take static values only, and binding them is a build error naming the place:

- `srcdoc`;
- `src` on `<iframe>`, `<frame>` and `<embed>`;
- `data` and `codebase` on `<object>`;
- `href` on `<base>`;
- `sandbox`, `allow` and `referrerpolicy` on `<iframe>`, so data can't loosen what an iframe may do;
- `href` on `<link>`, unless its `rel` is static and loads nothing: `<link rel="canonical" href="{{ url }}">` is fine.

## Not supported, and why

| Instead of | Write | Why |
|---|---|---|
| `{...attrs}` (Svelte, JSX) | `[...]="attrs"` | every binding is `name="value"` in a template; `{...}` is a build error saying so |
| `[aria.label]` and other dotted names | `[aria-label]` | only `class.` and `style.` take a `.`; any other is a build error |
| `[style.width.px]="n"` (Angular units) | `[style.width]="n + 'px'"` | one way to write a value, and no hidden units |
| `.prop` / property bindings (Lit, Angular) | a `<script>` in an island | the template sets attributes; `value` and `checked` already follow their property |
| `class:name` / `style:prop` (Svelte) | `[class.name]`, `[style.prop]` | one syntax for each thing |
| `on…` attributes | `(click)="…"` in an island | handlers are wired by clarusjs, not written as text |

::: tip
For events, use `(click)="…"` inside an interactive component, not `onclick`.
:::
