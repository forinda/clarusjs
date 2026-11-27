---
'clarusjs': patch
---

Two fixes for form fields:

- A textarea's `[value]` or `[(value)]` now renders as its text in the HTML. It used to render as a `value` attribute, which browsers ignore, so the textarea showed empty until JavaScript ran.
- Text typed into a field before its island attaches (with `attach="interaction"`, `"idle"` or `"visible"`) is no longer reset at attach. The replayed input writes it to state.
