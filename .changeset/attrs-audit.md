---
'clarusjs': minor
---

Fields and attributes, checked against Vue's exceptions (#241):

- **`false` is now a value** on the enumerated `spellcheck`, `draggable` and `contenteditable` (and `translate`: yes/no), and on the ARIA states `aria-expanded`, `aria-pressed`, `aria-checked` and `aria-selected`. Before, `[aria-expanded]="false"` removed the attribute. Other attributes keep "false removes it".
- **A field's `value` and `checked` are set last,** after `type`, `min`, `max` and `step`, so a browser doesn't clamp them.
- **`[(value)]`:**
  - text fields don't write while an input method composes (IME);
  - number and range inputs write numbers;
  - checkboxes with a value bind an array (checked when it includes the value);
  - `<select multiple>` (static or `[multiple]`) binds an array of the selected values;
  - a bound `<select>`'s options render `selected` on the server, so the choice shows before any JavaScript (values compare as text);
  - a number field keeps what's being typed (`1.0` isn't rewritten to `1`);
  - a checkbox group bound to a missing array starts an empty one.

  Radio, checkbox and number bindings need a static `type`; with a bound `[type]` the field binds as text.
- **Already right, now tested:** `form`, `list`, `width`/`height`, textarea `type`, and SVG attributes (case kept) are always attributes; `<option [value]>` works; a `null` value is an empty field.
