---
"@clarusjs/ui-primitives": minor
"@clarusjs/ui": minor
---

Toasts have kinds and your own look. `toast(message, { type: 'success' | 'error' | 'info' | 'warning', icon: false })`: each toast carries `data-type`, a default icon for its kind (hidden from screen readers) and the kind in words for them ("Error:"). `<toast-region>` takes templates: `@slot('toast')` is the markup of every toast (one root element, which becomes the toast), `@slot('success')` and the other kinds override it for that kind; the region copies it per toast and fills `data-part="toast-message"` (as text), `toast-action`, `toast-close` and `toast-icon`. `@clarusjs/ui` tints each kind from `--ui-success`, `--ui-danger`, `--ui-warning` and `--ui-accent`.
