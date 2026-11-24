---
'clarusjs': minor
---

Folder and config layouts (#456). A `+layout.tscl` in a folder of `src/pages` wraps every page in it and below it (deeper folders inside), and the plugin's `layouts` option wraps pages by route pattern (`{ layout, include, exclude }`, patterns as in `routes`; outermost, in order). The page's content fills the layout's default slot and its top-level `@slot('name') { }` fills the nearest layout's named slots; layouts get `path` and `params`, on the server and from the client router. `@layout none` opts a page out. `+` files under `src/pages` are never routes. Not yet: a page with a `<script>` of its own (a located error), `+layout.load.ts`, and Markdown pages.
