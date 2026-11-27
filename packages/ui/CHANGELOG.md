# @clarusjs/ui

## 0.3.0

### Minor Changes

- [#614](https://github.com/forinda/clarusjs/pull/614) [`60083b6`](https://github.com/forinda/clarusjs/commit/60083b67de9a5765050d5471eb8833ae4e3d99a3) Thanks [@forinda](https://github.com/forinda)! - Dialog backdrop variants: `data-backdrop="light" | "dark" | "blur" | "none"` on a dialog (and so on sheets and alert dialogs), read through two knobs, `--ui-backdrop-opacity` (0.45) and `--ui-backdrop-blur` (0px), which you can also set on `:root` for a site-wide default.

- [#631](https://github.com/forinda/clarusjs/pull/631) [`223bf01`](https://github.com/forinda/clarusjs/commit/223bf01c9ccb308e95a6bcb7ec3187a2e52a285a) Thanks [@forinda](https://github.com/forinda)! - Chip input: a field where each value typed becomes a chip (tags, email addresses). Enter or a comma adds, Backspace removes the last, × removes one; `[(values)]`, hidden inputs with `[name]`, and a cancelable `(change)`. `ui.css` styles it, and its chip and input rules are now a `chips` section shared with the combobox.

### Patch Changes

- [#620](https://github.com/forinda/clarusjs/pull/620) [`9c3d374`](https://github.com/forinda/clarusjs/commit/9c3d374f10ac25f44fcda8499164bfb439ec00e7) Thanks [@forinda](https://github.com/forinda)! - The token rules set `color-scheme` (light, and dark with the system or `data-theme="dark"`), so native controls (select popups, date pickers, scrollbars) follow the theme's mode.

- [#620](https://github.com/forinda/clarusjs/pull/620) [`f6ad653`](https://github.com/forinda/clarusjs/commit/f6ad6536c1203825cdd6c652f49c630bd3dbc9c8) Thanks [@forinda](https://github.com/forinda)! - A combobox shows one focus ring, on its box: the input inside no longer draws a second outline.

- [#574](https://github.com/forinda/clarusjs/pull/574) [`f7efc2e`](https://github.com/forinda/clarusjs/commit/f7efc2efa9b35a825b79b1b14e00dd07d1b3c36d) Thanks [@forinda](https://github.com/forinda)! - The READMEs point to ui.clarusjs.com, where the styled components to copy are.
- Updated dependencies [[`223bf01`](https://github.com/forinda/clarusjs/commit/223bf01c9ccb308e95a6bcb7ec3187a2e52a285a), [`e6c32e4`](https://github.com/forinda/clarusjs/commit/e6c32e4486075a27204747e79a0d432a643a5d0b), [`f7efc2e`](https://github.com/forinda/clarusjs/commit/f7efc2efa9b35a825b79b1b14e00dd07d1b3c36d)]:
  - @clarusjs/ui-primitives@0.3.0

## 0.2.0

### Minor Changes

- [#526](https://github.com/forinda/clarusjs/pull/526) [`fd89123`](https://github.com/forinda/clarusjs/commit/fd8912385cd5b6616545fb24076b6a088a51c44b) Thanks [@forinda](https://github.com/forinda)! - Chart colour tokens: `--ui-chart-1` to `--ui-chart-5`, five distinct series colours in light and dark, each at least 3:1 against `--ui-bg`.

- [#533](https://github.com/forinda/clarusjs/pull/533) [`6f6d757`](https://github.com/forinda/clarusjs/commit/6f6d757d5d58128be7d96579174ed4a7ad95c5e5) Thanks [@forinda](https://github.com/forinda)! - One size scale for controls: `--ui-control-sm`, `--ui-control-md` and `--ui-control-lg` (30, 36 and 44px at the default `--ui-space`, so Density scales them). Fields, selects, comboboxes and toggles take their height from it, and `data-size="sm"` or `"lg"` on a control or anything around it picks the size.

- [#515](https://github.com/forinda/clarusjs/pull/515) [`a232d46`](https://github.com/forinda/clarusjs/commit/a232d462ee4f1410040386b07a3967d01b11aaba) Thanks [@forinda](https://github.com/forinda)! - A spacing scale: `--ui-space` (4px) and its steps `--ui-space-1` to `--ui-space-12`. Every padding, margin and gap in `ui.css` is now a step of it (the same sizes as before at 4px), so one token makes the parts compact or roomy.

- [#509](https://github.com/forinda/clarusjs/pull/509) [`f0ecd5e`](https://github.com/forinda/clarusjs/commit/f0ecd5e364a0350610e4d32756b017dbeacd1326) Thanks [@forinda](https://github.com/forinda)! - Toasts have kinds and your own look. `toast(message, { type: 'success' | 'error' | 'info' | 'warning', icon: false })`: each toast carries `data-type`, a default icon for its kind (hidden from screen readers) and the kind in words for them ("Error:"). `<toast-region>` takes templates: `@slot('toast')` is the markup of every toast (one root element, which becomes the toast), `@slot('success')` and the other kinds override it for that kind; the region copies it per toast and fills `data-part="toast-message"` (as text), `toast-action`, `toast-close` and `toast-icon`. `@clarusjs/ui` tints each kind from `--ui-success`, `--ui-danger`, `--ui-warning` and `--ui-accent`.

- [#503](https://github.com/forinda/clarusjs/pull/503) [`312d157`](https://github.com/forinda/clarusjs/commit/312d157e3f9c9360a33b95d13e96c9a9ead11fd9) Thanks [@forinda](https://github.com/forinda)! - A `toggle` section styling `toggle`, `toggle-group` and `toggle-item` (pressed is tinted; a group joins its items into one row). A `toast` section: messages stacked at the bottom-right, each a card with its action and a close. A `sidebar` section: inline with its own surface on wide screens, hidden when collapsed (its `data-state` or `data-sidebar` on `<html>`), a panel from the left on phones.

- [#503](https://github.com/forinda/clarusjs/pull/503) [`05270e1`](https://github.com/forinda/clarusjs/commit/05270e1ddadf4bd1e52feebd0839457e4a2c9b5e) Thanks [@forinda](https://github.com/forinda)! - A `sheet` section: a dialog with `data-side="left|right|top|bottom"` sits against that side of the screen and slides in (no motion under reduced motion). The dialog now takes its text colour from `--ui-card-fg` (a duplicate `color` overrode it).

- [#493](https://github.com/forinda/clarusjs/pull/493) [`1a79aa8`](https://github.com/forinda/clarusjs/commit/1a79aa8fd2a8a54881d01789074229f8501cd5b9) Thanks [@forinda](https://github.com/forinda)! - 23 more `--ui-` tokens, matching shadcn's roles (34 in all): `--ui-card`/`-fg`, `--ui-popover`/`-fg`, `--ui-secondary`/`-fg`, `--ui-muted-bg`, `--ui-accent-soft-fg`, `--ui-danger-fg`, `--ui-input`, `--ui-ring`, `--ui-sidebar` (with `-fg`, `-accent`, `-accent-fg`, `-border`), `--ui-success`/`-fg`, `--ui-warning`/`-fg`, `--ui-font-heading`, `--ui-font-mono` and `--ui-font-size`, each with light and dark values. Their defaults equal what the parts look like today, so nothing changes until you set them.

  `ui.css`'s rules now sit in `@layer components` (the tokens stay unlayered), so Tailwind's utilities and any CSS you write outside a layer override them; they were already zero-specificity (`:where()`). It starts with `@layer theme, base, components, utilities;` (Tailwind's order), so its components rank above a Tailwind preflight whichever stylesheet loads first; without Tailwind the statement changes nothing.

### Patch Changes

- [#536](https://github.com/forinda/clarusjs/pull/536) [`0e53db9`](https://github.com/forinda/clarusjs/commit/0e53db9907a52c896809f9bbd90cba13adf37b4b) Thanks [@forinda](https://github.com/forinda)! - A combobox option that's already picked shows a check at its end in the list, as well as being bold (screen readers already heard `aria-selected`).

- [#536](https://github.com/forinda/clarusjs/pull/536) [`0e53db9`](https://github.com/forinda/clarusjs/commit/0e53db9907a52c896809f9bbd90cba13adf37b4b) Thanks [@forinda](https://github.com/forinda)! - A disabled field, select or combobox control looks disabled (dimmed, with a not-allowed cursor).

- [#556](https://github.com/forinda/clarusjs/pull/556) [`73bf92d`](https://github.com/forinda/clarusjs/commit/73bf92d6cd771c1ee51c8be459f7a5d234567fd1) Thanks [@forinda](https://github.com/forinda)! - Toasts: the icon and buttons line up on the message's first line, so a long message wraps under them (long words too) instead of the toast centring everything on it; the default info icon is a circled "i" (it was a dot and a stroke).

- [#493](https://github.com/forinda/clarusjs/pull/493) [`88f46d5`](https://github.com/forinda/clarusjs/commit/88f46d5c50055a80fa9d61780cc08261027adcf6) Thanks [@forinda](https://github.com/forinda)! - `ui.css` marks each part's rules with `/* part: name */` … `/* end part */` comments (no rule changes), so ui.clarusjs.com's copyable components can carry exactly the same rules, checked by a test.
- Updated dependencies [[`2ba72a9`](https://github.com/forinda/clarusjs/commit/2ba72a9a1800abf3e10cab399c0feeda14b45d12), [`2cb2c58`](https://github.com/forinda/clarusjs/commit/2cb2c5812318916cd72a5da13668f684418f83fa), [`312d157`](https://github.com/forinda/clarusjs/commit/312d157e3f9c9360a33b95d13e96c9a9ead11fd9), [`2aebdca`](https://github.com/forinda/clarusjs/commit/2aebdcab809fa03210bd6e1bcb3e12fcbc91a771), [`73bf92d`](https://github.com/forinda/clarusjs/commit/73bf92d6cd771c1ee51c8be459f7a5d234567fd1), [`8af4554`](https://github.com/forinda/clarusjs/commit/8af455488dece63dddddfdee29435b14856880eb), [`f0ecd5e`](https://github.com/forinda/clarusjs/commit/f0ecd5e364a0350610e4d32756b017dbeacd1326)]:
  - @clarusjs/ui-primitives@0.2.0

## 0.1.0

### Minor Changes

- [#489](https://github.com/forinda/clarusjs/pull/489) [`ebf0596`](https://github.com/forinda/clarusjs/commit/ebf0596c69ba02e05e2ecc1139147a6b5e4ada5a) Thanks [@forinda](https://github.com/forinda)! - Menu ([#465](https://github.com/forinda/clarusjs/issues/465)): `menu.tscl` (a small island) with `menu-trigger.tscl`, `menu-list.tscl` and `menu-item.tscl` (no script). The list is a popover opened by its trigger, so opening, closing, Escape and a click outside come from the browser; the menu moves focus in on open, keeps `aria-expanded` in step, adds arrow keys, Home, End and typeahead, and sends `(select)` with the item's value (cancellable). `@clarusjs/ui` styles them.

- [#487](https://github.com/forinda/clarusjs/pull/487) [`ec4cb9e`](https://github.com/forinda/clarusjs/commit/ec4cb9e8e9d534ee0ebfc04bc21d39d0a17b30e7) Thanks [@forinda](https://github.com/forinda)! - Radio group ([#465](https://github.com/forinda/clarusjs/issues/465)): `radio-group.tscl` (a small island) with `radio.tscl` (no script: it reads the group's name and value from context, so the server writes which one is checked). Native radios in a fieldset: arrow keys, one Tab stop and form submission from the browser. `[(value)]` binds the value and `(change)` can be cancelled. `@clarusjs/ui` styles them.

- [#481](https://github.com/forinda/clarusjs/pull/481) [`aac32f7`](https://github.com/forinda/clarusjs/commit/aac32f77c8518cb553dba517b05c9ca21a2737e0) Thanks [@forinda](https://github.com/forinda)! - Tabs ([#465](https://github.com/forinda/clarusjs/issues/465)), Radix-shaped: `tabs.tscl` (a small island) with `tab-list.tscl`, `tab.tscl` and `tab-panel.tscl`, which read the selection from context and ship nothing, so the server writes every ARIA attribute and `hidden`. Arrow keys, Home and End select; `[(value)]` binds the selected value and `(change)` can be cancelled. `@clarusjs/ui` styles them.

- [#488](https://github.com/forinda/clarusjs/pull/488) [`5ddef98`](https://github.com/forinda/clarusjs/commit/5ddef98f24fb0b3d7c992300d746edfe6a665a15) Thanks [@forinda](https://github.com/forinda)! - Tooltip ([#465](https://github.com/forinda/clarusjs/issues/465)): `tooltip.tscl` (a hint popover, `popover="hint"`, anchored to its trigger) and `tooltip-trigger.tscl` (a button described by it). Browsers with interest invokers (`interestfor`) show and hide it themselves; elsewhere the trigger, a small island, does: on hover after a short delay, on focus, kept open while the pointer is on it, closed on Escape, blur or leaving. `@clarusjs/ui` styles it.

- [#474](https://github.com/forinda/clarusjs/pull/474) [`fa6df8f`](https://github.com/forinda/clarusjs/commit/fa6df8fafa574bb9c5d7736df1caedd3d02b01c7) Thanks [@forinda](https://github.com/forinda)! - `@clarusjs/ui` ([#467](https://github.com/forinda/clarusjs/issues/467)), a new package: one stylesheet (`@import '@clarusjs/ui/ui.css'`) for `@clarusjs/ui-primitives`' parts, over their `data-part` names and state attributes. Design tokens (`--ui-accent`, `--ui-radius`, `--ui-font`…) with dark values by `prefers-color-scheme` or `data-theme`; every selector in `:where()`, so your CSS always wins; a visible focus ring, invalid fields marked by border, and no transitions with reduced motion. CSS only.

### Patch Changes

- Updated dependencies [[`6d54f6f`](https://github.com/forinda/clarusjs/commit/6d54f6f1e610b5449a7caeb68ed50767dede92a7), [`b02ebc8`](https://github.com/forinda/clarusjs/commit/b02ebc83e348a81cd71e1e437902ec43bb71ad66), [`57a0b91`](https://github.com/forinda/clarusjs/commit/57a0b91c53294ec5986a6b5e141a731397025769), [`e61e09c`](https://github.com/forinda/clarusjs/commit/e61e09c6e2cece2d8a051f095afd075e1788e042), [`ebf0596`](https://github.com/forinda/clarusjs/commit/ebf0596c69ba02e05e2ecc1139147a6b5e4ada5a), [`ec4cb9e`](https://github.com/forinda/clarusjs/commit/ec4cb9e8e9d534ee0ebfc04bc21d39d0a17b30e7), [`5a8fe18`](https://github.com/forinda/clarusjs/commit/5a8fe1846f9663d0c1fbb9494e458de1a113e1d3), [`aac32f7`](https://github.com/forinda/clarusjs/commit/aac32f77c8518cb553dba517b05c9ca21a2737e0), [`5ddef98`](https://github.com/forinda/clarusjs/commit/5ddef98f24fb0b3d7c992300d746edfe6a665a15), [`a8ea351`](https://github.com/forinda/clarusjs/commit/a8ea3512a4807e3398b01b4747fc027d29222976)]:
  - @clarusjs/ui-primitives@0.1.0
