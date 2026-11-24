---
title: "Menu"
group: "Components"
order: 11
description: "A menu button: a popover list of actions opened by its trigger, with arrow keys and typeahead."
---

# Menu

<p class="lead">A list of actions behind a button. The list is a popover, so opening, closing, Escape and a click outside come from the browser; the menu adds the keyboard.</p>

<uiGallery part="menu" />

```tscl
@import uiMenu from '@clarusjs/ui-primitives/menu.tscl'
@import uiMenuTrigger from '@clarusjs/ui-primitives/menu-trigger.tscl'
@import uiMenuList from '@clarusjs/ui-primitives/menu-list.tscl'
@import uiMenuItem from '@clarusjs/ui-primitives/menu-item.tscl'

<uiMenu id="file" (select)="run($event)">
  <uiMenuTrigger>File</uiMenuTrigger>
  <uiMenuList>
    <uiMenuItem value="new">New</uiMenuItem>
    <uiMenuItem value="open" [disabled]="true">Open…</uiMenuItem>
  </uiMenuList>
</uiMenu>
```

- **`id`** names the menu: its trigger and list get ids from it, and the list is labelled by the trigger.
- **`(select)`** comes with the chosen item's **`value`**, then the menu closes; `$info.cancel()` keeps it open.
- **Keyboard:** opening moves focus to the first item; ↑ ↓ move, Home and End jump, typing a letter goes to the item starting with it, Enter or Space picks, Escape closes and focus goes back to the trigger. Disabled items are skipped.
- **`menu-trigger`, `menu-list` and `menu-item`** have no script and ship nothing; the trigger and list read the menu's id from [context](/guide/context). Only the menu itself is a small island.
- **Styling:** `data-part` `menu`, `trigger`, `menu-list` and `menu-item`; `:popover-open` on the list, `aria-expanded` on the trigger, `aria-disabled` on items.

From [`@clarusjs/ui-primitives`](/guide/ui-primitives#parts), styled by `@clarusjs/ui`: `@import '@clarusjs/ui/ui.css'` once, and change the look with its `--ui-` tokens (`--ui-accent`, `--ui-radius`, `--ui-font`…). Without it, the part is unstyled and works the same.
