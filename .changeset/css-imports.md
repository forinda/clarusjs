---
"clarusjs": minor
---

Stylesheet imports and per-page CSS: `@import './x.css'` (no name) in a page or component declares a stylesheet it needs. Each goes through Vite's CSS pipeline (PostCSS or Lightning CSS, minified and hashed), and each page links exactly the stylesheets it imports directly or through its components, dependencies first, before the component styles. Client-route shells link every client page's stylesheets; fragments carry their page's links, and fragment navigation adds and waits for any that are missing. The client router now keeps the head across navigations (it updates the title and `<html>` attributes and runs the new page's inline head scripts), so linked stylesheets stay.
