---
title: "Tabs"
group: "Components"
order: 8
description: "Tabs over panels, Radix-shaped: the parts read the selection from context, so the server writes their ARIA and nothing jumps."
---

# Tabs

<p class="lead">Tabs over panels you write. Each part says only its own value; the server writes every ARIA attribute and <code>hidden</code>, so nothing jumps when the page loads. Only the root is a small island.</p>

**Styled:** [Tabs on ui.clarusjs.com](https://ui.clarusjs.com/components/tabs), ready to copy, in plain CSS or Tailwind.

<tabsDemo />

```tscl
@import uiTabs from '@clarusjs/ui-primitives/tabs.tscl'
@import uiTabList from '@clarusjs/ui-primitives/tab-list.tscl'
@import uiTab from '@clarusjs/ui-primitives/tab.tscl'
@import uiTabPanel from '@clarusjs/ui-primitives/tab-panel.tscl'

<uiTabs id="install" label="Install" value="npm">
  <uiTabList>
    <uiTab value="npm">npm</uiTab>
    <uiTab value="pnpm"><icon name="lucide:package" /> pnpm</uiTab>
  </uiTabList>
  <uiTabPanel value="npm">npm i clarusjs</uiTabPanel>
  <uiTabPanel value="pnpm">pnpm add clarusjs</uiTabPanel>
</uiTabs>
```

- **Each part says only its own value.** `tab-list`, `tab` and `tab-panel` read the rest from the `tabs` around them ([context](/guide/context)), so they ship no JavaScript and the server writes their ARIA and `hidden`.
- **`id`** names the group: its tabs and panels get ids from it. **`label`** labels the tab list.
- **`value`** is the selected tab's value, or bind it with **`[(value)]`**. A tab can hold any content, an icon included.
- **`(change)`** comes first with the new value; `$info.cancel()` keeps the current tab.
- **Keyboard:** ← → move between tabs and select them; Home and End jump.
- **Styling:** `data-part` `tabs`, `list`, `tab` and `panel`; the selected tab has `aria-selected="true"`.

## In an island

Tabs work inside a page or component with state too: its holes and handlers inside the panels stay its own, and the tabs keep theirs ([slots in an island](/guide/slots#slots-in-an-island)). This one binds the tab two ways, and "Locked" cancels the change:

<tabsBoundDemo />

From [`@clarusjs/ui-primitives`](/guide/ui-primitives#parts), styled by `@clarusjs/ui`: `@import '@clarusjs/ui/ui.css'` once, and change the look with its `--ui-` tokens (`--ui-accent`, `--ui-radius`, `--ui-font`…). Without it, the part is unstyled and works the same.
