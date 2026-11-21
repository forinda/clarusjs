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
  - `<select multiple>` binds an array of the selected values.
- **Already right, now tested:** `form`, `list`, `width`/`height`, textarea `type`, and SVG attributes (case kept) are always attributes; `<option [value]>` works; a `null` value is an empty field.
