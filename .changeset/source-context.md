---
"clarusjs": patch
---

Page sources get `root` and `addDependency(file)` in their context (files they read are watched in dev), and only apply under `src/pages`: a source-extension file elsewhere (such as a Markdown part to include) is not a page or a component.
