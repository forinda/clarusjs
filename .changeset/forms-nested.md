---
'clarusjs': patch
---

Forms: an engine over many fields stays quick, and nested sections keep the right marks. Each change re-checks the fields once (it re-read every field's path for every field before, so a keystroke in a form with a thousand fields took seconds), and after rows or sections are added or removed, each field's error mark follows its own value.
