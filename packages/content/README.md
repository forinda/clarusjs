# @clarusjs/content

Markdown pages for [clarusjs](https://github.com/forinda/clarusjs). Every `.md` file under `src/pages` becomes a page: its Markdown is rendered to static HTML inside your layout at build time.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'
import markdown from '@clarusjs/content'

export default defineConfig({
  plugins: [clarusjs({ sources: [markdown({ layout: '/src/layouts/docs.tscl' })] })],
})
```

- **Frontmatter:** `title`, `description` and `layout` (a root-relative path, or `false` for none).
- **Components in Markdown:** `@import name from '…'` lines at the top, then use the component like HTML.
- **Headings** get ids and anchor links.
- **Static output:** `{{ }}` and `@` in your prose are text, never template code.

Build-time only: nothing here ships to the browser. See the [Markdown pages guide](https://clarusjs.netlify.app/guide/markdown).

MIT licensed.
