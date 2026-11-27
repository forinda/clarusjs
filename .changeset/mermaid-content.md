---
'@clarusjs/content': minor
---

`markdown({ mermaid: { tag, from } })`: a ```` ```mermaid ```` block becomes its source in `<pre class="mermaid">` (not highlighted) with your diagram component after it, which draws it in the browser. Without the option a ```` ```mermaid ```` block is code, as before.
