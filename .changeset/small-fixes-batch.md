---
'clarusjs': patch
'@clarusjs/content': patch
---

- `clarusjs check`: client routes render in the browser, so a `<script server>` in their pages, or in what those use, is an error (as the build reports it).
- A Markdown page with no layout gets its title (with the site's title template) and description in its head; a `<cl-head>` `<title data-cl-template>` gets the template.
- Lint: a name spread into an array or object (`...name`) counts as read.
- `@transition`: in `in-out` mode the old branch's text goes and its enter stops at the change; finished transitions leave no timer behind; the loader cleans up once per change; a leaving copy no longer blocks a hot-reload swap; an island waiting to attach never attaches once it's leaving.
