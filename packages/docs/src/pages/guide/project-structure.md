---
title: "Project structure"
description: "Where pages, layouts, components and stores live in a clarusjs project."
---

# Project structure

<p class="lead">clarusjs only requires <code>src/pages</code>. Everything else is a convention this site follows.</p>

```text
my-site/
├── vite.config.ts        clarusjs() plugin
├── public/               copied to the build as is (CSS, images)
└── src/
    ├── pages/            one .tscl file per route
    │   ├── index.tscl          /
    │   └── guide/intro.tscl    /guide/intro
    ├── layouts/          components that render the whole page
    ├── components/       everything else you import
    └── stores/           shared state for islands (.ts)
```

## Generated folders

- `dist/client`: the static site; `dist/server`: the request handler.
- `.clarusjs/`: files `clarusjs check` generates. Keep it out of version control.
