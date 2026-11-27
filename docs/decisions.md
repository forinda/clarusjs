# Measured and rejected

Approaches that were tried or measured and set aside, with why. Read this before changing size budgets, bundling,
module resolution, formatting or the playground: if what you're about to try is here, the result is already known.
Revisit an entry only with a new reason (a new tool version, a changed constraint) and record what changed.

## Bundling and size

- **Stronger Oxc minify options** (#198). No change in output size: the default settings already do what the extra
  options would. Not worth the config.
- **A shared navigation-guard chunk** (#186). Splitting the guard into its own chunk saves about 200 bytes but costs a
  request on every page, because a page loads exactly one navigator anyway. Kept inline.
- **The h() brand check in `runtime/serialize.ts`** (#301). It took the browser runtime to 5,133 B gzip, over the 5 KB
  budget. The check moved to the server-only `toBrowser()` in `runtime/server.ts`; the browser never needs it, since
  `h()` output only exists on the server.
- **Removing whitespace between tags at build** (#309). Only safe when the CSS is known: between inline-block elements
  the space shows. `collapseWhitespace` collapses each run to one character instead. That keeps the docs site's HTML
  smaller than before it was formatted (2.72 MB against 2.84 MB), so removal would gain little.
- **A json-only filter for the scripts a client-route swap re-runs** (router budget 1.5 → 1.6 KB). Skipping
  `[type*=json]` by selector, without keeping a module's type, still came out at 1,540 B, over 1,536. It also fails
  open: any other data type (`text/plain`, a template) would run. The allowlist (no type, `module`, a JavaScript type)
  that keeps the type is 1,585 B; the budget went to 1,638.

## Module resolution

- **Vite's `resolve.tsconfigPaths`** (#210). It doesn't apply to `.tscl` files, so `~/` imports in components wouldn't
  resolve. The plugin resolves `~/` itself.
- **A `resolve.alias` string find for `~/`** (#210). A string `find` matches only the string itself or the string
  followed by `/`, so it can't express the prefix. A regular expression would work, but the plugin's own resolution
  already covers it.

## Formatting and linting

- **oxfmt for `.tscl`** (#303). oxfmt can't load third-party Prettier plugins yet; plugin support is on its roadmap.
  `.tscl` files are formatted with Prettier and `@clarusjs/prettier-plugin`. Check oxfmt's plugin support before
  revisiting.
- **oxlint on `.tscl`** (#305). oxlint's JS plugins don't support custom file formats yet ("research and scope out" for
  template syntax). ESLint with a processor is the path until they do.
- **Laying out every block with Prettier's Angular printer** (#306). Angular puts a block on lines of its own; in inline
  content (`Hello @if (x) {<b>world</b>}!`, an `@if` inside `<a>`, blocks alternating `<code>` and `<span>`) the new
  line breaks render as spaces. Measured on the docs site: 11 of 72 pages showed different text. The plugin keeps such
  blocks as written, laying out only blocks whose edges already have whitespace or touch block-level elements.

## Docs playground

- **The preview frame as a page of the site (`/repl/frame`)** (#243). A sandboxed frame without `allow-same-origin`
  has an opaque origin, and module scripts are fetched with CORS, which static hosts don't send for `/assets`. The frame
  is a `srcdoc` document instead, with the runtime bundled into one inline script (`virtual:repl-runtime`).
