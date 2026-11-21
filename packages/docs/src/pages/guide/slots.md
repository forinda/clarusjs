---
title: "Slots"
group: "Templates"
order: 7
description: "Wrap content with <slot />, named slots and fallback content."
---

# Slots

<p class="lead">A component without a script can wrap content: whatever you put between its tags renders at its <code>&lt;slot /&gt;</code>.</p>

```tscl
{{-- components/card.tscl --}}
<section class="card"><slot /></section>

{{-- a page --}}
<card><p>Inside the card.</p></card>
```

The content belongs to the page that writes it, so its holes read the page's inputs. This is how layouts work: this site's layout is a component, and every page wraps its content in it.

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
