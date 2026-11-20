---
"clarusjs": patch
---

URL checks now cover every entry of list-valued attributes: each space-separated URL of `ping`, and each `;`-separated entry of `values` on SVG animation elements. SVG animation attributes (`to`, `from`, `values`, `by`) are only URL-checked on `<animate>`, `<set>`, `<animateMotion>` and `<animateTransform>`; on other elements they are ordinary data.
