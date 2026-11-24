---
title: "Tabs"
group: "Components"
order: 8
description: "A tab list over panels the page writes: the panels are server HTML with their ARIA, the list is a small island."
---

# Tabs

<p class="lead">A tab list over panels you write. The panels are server HTML with their ARIA and <code>hidden</code>, so nothing jumps when the page loads; the list is a small island.</p>

<tabsDemo />

```tscl
@import uiTabs from '@clarusjs/ui-primitives/tabs.tscl'
@import uiTabPanel from '@clarusjs/ui-primitives/tab-panel.tscl'

<uiTabs id="install" label="Install" [tabs]="['npm', 'pnpm']" [(value)]="tab">
  <uiTabPanel group="install" [index]="0">npm i clarusjs</uiTabPanel>
  <uiTabPanel group="install" [index]="1">pnpm add clarusjs</uiTabPanel>
</uiTabs>
```

- **`id`** names the group, and each panel's **`group`** is that id; **`index`** is its place among the tabs.
- **`[(value)]`** is the selected tab's index. To start on another tab, give each panel the same **`[selected]`**, so the server hides the right ones.
- **Keyboard:** ← → move between tabs and select them; Home and End jump.
- **`(change)`** comes first with the new index; `$info.cancel()` keeps the current tab.
- **Styling:** `data-part` `tabs`, `list`, `tab` and `panel`; the selected tab has `aria-selected="true"`.
- **Write the tabs in a page or a component without a script.** Inside another island they're a render error for now ([slots in an island](/guide/slots#slots-in-an-island)).

From [`@clarusjs/ui-primitives`](/guide/ui-primitives#parts), styled by `@clarusjs/ui`: `@import '@clarusjs/ui/ui.css'` once, and change the look with its `--ui-` tokens (`--ui-accent`, `--ui-radius`, `--ui-font`…). Without it, the part is unstyled and works the same.
