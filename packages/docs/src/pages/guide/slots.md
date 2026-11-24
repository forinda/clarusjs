---
title: "Slots"
group: "Templates"
order: 7
description: "Wrap content with <slot />, named slots and fallback content, and slots that pass data to their content."
---

# Slots

<p class="lead">A component without a script can wrap content: whatever you put between its tags renders at its <code>&lt;slot /&gt;</code>.</p>

```tscl
{{-- components/card.tscl --}}
<section class="card"><slot /></section>

{{-- a page --}}
<card><p>Inside the card.</p></card>
```

The content belongs to the page that writes it, so its holes read the page's inputs. This is how [layouts](/guide/layouts) work: this site's layout is a component, and every page wraps its content in it.

## Named slots

Give slots names, and fill them from the parent with `@slot('name') { … }`; everything else goes to the default slot. Content inside a `<slot>` is the fallback, shown when nothing fills it.

```tscl
{{-- components/panel.tscl --}}
<section>
  <header><slot name="head">Untitled</slot></header>
  <slot />
</section>

{{-- a page --}}
<panel>
  @slot('head') { <h2>Settings</h2> }
  <p>Everything else is the default slot.</p>
</panel>
```

## Slots that pass data

A component can hand data to the content filling a slot. A list renders its rows, and lets the page decide what each row looks like:

```tscl
{{-- components/item-list.tscl --}}
@input items: { id: string; label: string }[]
<ul>
  @for (item of items; track item.id) {
    <li><slot name="row" [item]="item" [index]="$index">{{ item.label }}</slot></li>
  }
</ul>

{{-- a page --}}
<itemList [items]="steps">
  @slot('row', { item, index }) {
    <strong>{{ index + 1 }}.</strong> {{ item.label }}
  }
</itemList>
```

- **The component passes values** with bindings on `<slot>`: `[item]="item"`, `[label]="'Total'"`. The slot's own content is still the fallback, shown when nothing fills it, and it can use the same values.
- **The fill names them** after the slot's name, like a function's parameter: `{ item, index }`, `{ item: step }` to rename, `{ item, note = '' }` for a default, or `props` for all of them. They're the fill's own; the page's other names are there too.
- **The default slot** passes data the same way: `<slot [item]="item" />`, filled by `@slot('default', { item }) { … }`.
- **A fill that takes nothing** works as before, even on a slot that passes data.

<slotsDemo />

`clarusjs check` checks the values where the component passes them; the names a fill receives are typed `any` for now. A fill that receives data can't be inside an [island](/guide/islands) yet (the compiler says so at its place): render that component outside the island, or pass the data in as props.
