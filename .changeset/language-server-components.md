---
'@clarusjs/language-server': minor
---

Components in templates: completion of the file's imported components as tags, and of their inputs (`[title]`), models (`[(open)]`) and events (`(rate)`) as bindings; hover on a component tag (where it comes from, its inputs with whole types, multi-line ones too, its models and events); go to definition from a tag or its `@import` specifier. Also directives (`@if`, `@import`…), `@import` paths, and the binding forms of HTML attributes (`[disabled]`, `(click)`, `[(value)]` on fields, `[value]` on `textarea` and `select`) through the HTML service.
