---
title: "Accordion"
group: "Components"
order: 3
description: "Sections that open and close: <details> and <summary>, one open at a time in a group. No JavaScript."
---

# Accordion

<p class="lead">Sections that open and close: &lt;details&gt; and &lt;summary&gt;, one open at a time in a group. No JavaScript.</p>

**Styled:** [Accordion on ui.clarusjs.com](https://ui.clarusjs.com/components/accordion), ready to copy, in plain CSS or Tailwind.

<uiGallery part="accordion" />

```tscl
@import uiAccordionItem from '@clarusjs/ui-primitives/accordion-item.tscl'

<uiAccordionItem group="faq" [open]="true">
  @slot('trigger') { Is it free? }
  Yes, MIT licensed.
</uiAccordionItem>
```

- **`group`**: items with the same group are exclusive. **`open`**: open at first.
- Find in page opens a closed one. **Styling:** `details[open]`; parts `accordion-item`, `trigger`, `panel`.

From [`@clarusjs/ui-primitives`](/guide/ui-primitives#parts), styled by `@clarusjs/ui`: `@import '@clarusjs/ui/ui.css'` once, and change the look with its `--ui-` tokens (`--ui-accent`, `--ui-radius`, `--ui-font`…). Without it, the part is unstyled and works the same.
