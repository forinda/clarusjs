# clarusjs

## 0.5.0

### Minor Changes

- [#103](https://github.com/forinda/clarusjs/pull/103) [`a1ae98a`](https://github.com/forinda/clarusjs/commit/a1ae98aafbf13bc9a367a04a75c7c04d926cd10a) Thanks [@forinda](https://github.com/forinda)! - Client routes: `routes: { '/app/*': 'client' }`. A client route is answered with a shell (the island loader, a router under 1 KB gzip and a table of the client routes); the router loads the page's render module and its `<path>/__data.json` (params plus `load()`, written at build, served by the handler in dev and on a server), renders the page in the browser and attaches its islands. Navigations between client routes go through the Navigation API without reloads; browsers without it load pages normally, and a page that fails to render falls back to a normal load. The manifest and `clarusjs explain` show client routes. Also fixes nested components in browser render modules: a `?render` module now imports its child components as render modules too.

- [#88](https://github.com/forinda/clarusjs/pull/88) [`a003443`](https://github.com/forinda/clarusjs/commit/a00344314c132d7caad2cd737873e48e16e404f3) Thanks [@forinda](https://github.com/forinda)! - Dynamic routes: `src/pages/users/[id].tscl` renders `/users/<anything>`, with each `[param]` passed to the page as a string input. Static routes win over dynamic ones. A static build lists a dynamic route's pages with `entries()` exported from `[id].load.ts`; a dynamic route without it, or an entry value that is empty, `.`, `..` or contains `/`, fails the build naming the file.

- [#101](https://github.com/forinda/clarusjs/pull/101) [`23aa505`](https://github.com/forinda/clarusjs/commit/23aa5052a590d0f1cb13858536e36fa20e91c642) Thanks [@forinda](https://github.com/forinda)! - `adapter: 'netlify'`: `vite build` writes a Netlify Function (`.netlify/v1/functions/clarusjs-server.mjs`, Frameworks API) that runs the same `fetch` handler for server routes only, with their paths in URLPattern syntax and static files served first. No server routes, no function. An unknown adapter is a config error.

- [#91](https://github.com/forinda/clarusjs/pull/91) [`956ddb9`](https://github.com/forinda/clarusjs/commit/956ddb99b059ffc5eeca0842021dee496761653e) Thanks [@forinda](https://github.com/forinda)! - Per-route rendering modes: `clarusjs({ routes: { '/account/*': 'server' } })`. Static routes (the default) are prerendered; server routes are left out of prerendering (a dynamic one needs no `entries()`) and render per request from `dist/server/index.mjs`, with `load()` getting the visitor's request. The most specific pattern wins; an unknown mode or a malformed pattern is a config error. `vite preview` serves server routes through the built handler, and the route manifest and `clarusjs explain` show each route's mode.

- [#89](https://github.com/forinda/clarusjs/pull/89) [`b9cbda3`](https://github.com/forinda/clarusjs/commit/b9cbda3440ddec1ab417737c111525fde3cb0b3c) Thanks [@forinda](https://github.com/forinda)! - Typed loaders: a page's `.load.ts` can export `load({ params, request })`. It runs on the server (at build time for prerendered pages, never in the browser), and what it returns is merged into the page's inputs. `clarusjs check` checks the returned value against the page's `@input` types. A loader that throws or returns a non-object answers 500 with no internal details and logs the error (at build, the build fails naming the loader). The route manifest and `clarusjs explain` show which pages ran a loader.

- [#104](https://github.com/forinda/clarusjs/pull/104) [`41bc58e`](https://github.com/forinda/clarusjs/commit/41bc58e4cae6377eb901643b131d1df76106ddb2) Thanks [@forinda](https://github.com/forinda)! - `render(name, props)` from `clarusjs/views`: render any view under `src/` to HTML from server code (a loader, a script importing the built server), by its path without the extension (`render('components/pill', { text })`). The server entry registers every view, and `dist/server/index.mjs` exports `render` too. `clarusjs check` writes `.clarusjs/views.d.ts`, a registry of each view's inputs, so an unknown name or a wrong prop is a type error; add it to your tsconfig's `include` for editor types.

### Patch Changes

- [#88](https://github.com/forinda/clarusjs/pull/88) [`93d60ba`](https://github.com/forinda/clarusjs/commit/93d60ba1a1352d9ec8244eb5fc675fde4c411e83) Thanks [@forinda](https://github.com/forinda)! - README: the logo's alt text is just "clarusjs logo".

## 0.4.0

### Minor Changes

- [#76](https://github.com/forinda/clarusjs/pull/76) [`c95cf7e`](https://github.com/forinda/clarusjs/commit/c95cf7e45564487990d414ed6677d971d5ff510b) Thanks [@forinda](https://github.com/forinda)! - `clarusjs check [--json] [dir]`: type-checks every `.tscl` file under `src/` (and the TypeScript they use) with the project's TypeScript and reports each error at `file.tscl:line:col`, including template syntax errors. Extends the project's `tsconfig.json`; exits with 1 when there are errors. The command line is built on `commander` (zero dependencies, Node only, never in browser bundles).

- [#79](https://github.com/forinda/clarusjs/pull/79) [`422aef1`](https://github.com/forinda/clarusjs/commit/422aef1139bcf44a4f8f77d000a26d7f1994ca00) Thanks [@forinda](https://github.com/forinda)! - Data imports in templates: `@import { a, b } from './data.ts'` or `@import data from './data.json'` (a default import of anything that isn't a `.tscl` file). In components without a script the import is server-only, so build-time data and even `node:` modules stay off the browser; in islands it is bundled for the browser like a script import, and `node:` imports are a build error. `clarusjs check` types the imported values.

- [#83](https://github.com/forinda/clarusjs/pull/83) [`ac68e3b`](https://github.com/forinda/clarusjs/commit/ac68e3bd4e2af1496ab74f65f124395a0b6e77a0) Thanks [@forinda](https://github.com/forinda)! - `clarusjs explain [route]`: where each part of a built route runs, in plain words (rendered at build time, its data, each island with its size and when it attaches, JavaScript on page load and in all, CSS), read from `dist/clarusjs-manifest.json`. Without a route it lists every route; `--json` prints the manifest entry.

- [#84](https://github.com/forinda/clarusjs/pull/84) [`2a34788`](https://github.com/forinda/clarusjs/commit/2a3478813eee74f61030ecf0281481933c9f6d8e) Thanks [@forinda](https://github.com/forinda)! - `readManifest()` from `clarusjs/manifest`: a page can read the route manifest while the site is built. Pages that call it are rendered again once the manifest is written, so they show the final build; outside a build it returns `null`.

- [#82](https://github.com/forinda/clarusjs/pull/82) [`ce4f6d0`](https://github.com/forinda/clarusjs/commit/ce4f6d0ffbb4a7105e6b9f9a8608748520d201e6) Thanks [@forinda](https://github.com/forinda)! - `vite build` writes `dist/clarusjs-manifest.json`: for every route, its mode, its loader, the islands it renders (component, attach mode, count, gzip size) and the JavaScript and CSS it ships, with the gzip bytes that load with the page and in all. Read from the prerendered HTML and Vite's client manifest; kept outside `dist/client` so it isn't published.

- [#85](https://github.com/forinda/clarusjs/pull/85) [`2d27d2f`](https://github.com/forinda/clarusjs/commit/2d27d2fdf2b990a5a88239770e3ddd90e428d8d9) Thanks [@forinda](https://github.com/forinda)! - **Breaking:** component files use the `.tscl` extension instead of `.clarus`. Plain JavaScript works out of the box; types stay optional. Rename your files (`for f in $(git ls-files '*.clarus'); do git mv "$f" "${f%.clarus}.tscl"; done`) and the imports that name them. The Vite plugin, `clarusjs check` and error locations (`file.tscl:line:col`) all use the new extension.

- [#75](https://github.com/forinda/clarusjs/pull/75) [`90ecef5`](https://github.com/forinda/clarusjs/commit/90ecef52604fac3784a2cfca7a73b91f38a47416) Thanks [@forinda](https://github.com/forinda)! - Type-checking groundwork: `@import type { User } from '…'` brings types into a component for its `@input` declarations (erased from compiled output), and a generator turns each `.tscl` file into virtual TypeScript (`@if` → `if` with narrowing, `@for` → `for…of`, components → objects typed as the child's `Inputs`, typed `$event`) with mappings back to the template, so `tsc` errors can be reported at `file.tscl:line:col`.

### Patch Changes

- [#86](https://github.com/forinda/clarusjs/pull/86) [`477b4e5`](https://github.com/forinda/clarusjs/commit/477b4e5430a3dd6646558877d36ea3141073af72) Thanks [@forinda](https://github.com/forinda)! - New logo: the TSCL mark (a cut crystal flat along a T, an S-shaped lightning bolt, C and L down the stem).

## 0.3.0

### Minor Changes

- [#68](https://github.com/forinda/clarusjs/pull/68) [`d640b3b`](https://github.com/forinda/clarusjs/commit/d640b3b6933112fbf1d4d0c819b38650f3b87c01) Thanks [@forinda](https://github.com/forinda)! - Components inside islands: an island's template can use other components, including inside `@if` branches and `@for` rows. A component without a script is re-rendered in the browser when the props or slot content it gets from the island change (its server render function is imported with the plugin's new `?render` query). A component with a script is its own island, keeps its own state and starts from the props it was first given; islands inserted later are attached automatically.

- [#59](https://github.com/forinda/clarusjs/pull/59) [`3bbfae6`](https://github.com/forinda/clarusjs/commit/3bbfae6f70c8d819abeb7d893fd255b5e633517c) Thanks [@forinda](https://github.com/forinda)! - Dynamic attributes: bind with `[name]="expression"` on HTML elements or use `{{ }}` inside attribute values. Values are escaped, URL attributes never get `javascript:`/`vbscript:` URLs, `true`/`false`/`null` add or remove boolean attributes, and attributes that read state update live inside islands. `on*` attributes are a build error; use `(event)` bindings.

- [#66](https://github.com/forinda/clarusjs/pull/66) [`f053f7c`](https://github.com/forinda/clarusjs/commit/f053f7ce4e87d527f45ef7581060ece4382a80aa) Thanks [@forinda](https://github.com/forinda)! - `@for (item of list; track key) { … } @empty { … }` loops, with `$index`. Outside islands the list renders on the server. Inside an island rows are reconciled by key when the list changes: kept rows keep their elements (moved only when out of order) and receive the new item and index, new rows are rendered and wired, removed rows are disposed. Event handlers in a row get that row's item, and `@if` blocks and attributes inside rows stay reactive.

- [#65](https://github.com/forinda/clarusjs/pull/65) [`3a5ba06`](https://github.com/forinda/clarusjs/commit/3a5ba0670e8d49afd0f0359e063324728a3a658a) Thanks [@forinda](https://github.com/forinda)! - `@if` / `@else if` / `@else` blocks. Outside islands the branch is chosen on the server and costs nothing in the browser. Inside an island the block switches when the state it reads changes: the server-rendered branch is wired in place, and a new branch is rendered in the browser and wired, with the old branch's effects and event handlers disposed. Signals gain `scope()`, `onDispose()` and `untrack()`.

- [#68](https://github.com/forinda/clarusjs/pull/68) [`fd99d7f`](https://github.com/forinda/clarusjs/commit/fd99d7f11bdd71c74e5ebebb5a4c5f8dc14ae1d1) Thanks [@forinda](https://github.com/forinda)! - Islands start from the server's state: each island's `state()` values are rendered into an `s` attribute and `attach` uses them, so initial values like `Date.now()` aren't recomputed in the browser. Island props and state are serialized with Date, Map, Set, undefined, NaN, ±Infinity, -0 and BigInt support; functions, class instances and circular references are rejected with their path (NaN and Infinity in props now round-trip instead of being rejected). Island props and state are public (they are in the page), so an island script that reads server-only globals (`process`, `Deno`, `Bun`, `require`) is a build error.

- [#68](https://github.com/forinda/clarusjs/pull/68) [`926269e`](https://github.com/forinda/clarusjs/commit/926269ec92481e4af1442ed000e8690ae1a72477) Thanks [@forinda](https://github.com/forinda)! - Lazy attach: `attach="idle"`, `attach="visible"` or `attach="interaction"` on a component tag delays loading an island's code until the browser is idle, the island scrolls into view, or someone uses it. In every mode, clicks, key presses, input and form submissions inside an island before it attaches are held and replayed afterwards, so nothing is lost while its code loads. Compiled `render()` takes an options argument (`render(props, slots, { attach })`).

- [#67](https://github.com/forinda/clarusjs/pull/67) [`2a881ed`](https://github.com/forinda/clarusjs/commit/2a881edc6a898b97e74fdcd8b47076198c085f9e) Thanks [@forinda](https://github.com/forinda)! - Named slots: `<slot name="…">` in a component, filled from the parent with `@slot('name') { … }`; everything else goes to the default slot. Content inside a `<slot>` is its fallback, shown when nothing fills it. Filling a slot the component doesn't have fails when rendering, naming the slot. Compiled `render()` now takes its slot content as an object (`render(props, slots)`).

- [#68](https://github.com/forinda/clarusjs/pull/68) [`94ee621`](https://github.com/forinda/clarusjs/commit/94ee621b6207af2d346d2fde6b2f4c6e46a884d1) Thanks [@forinda](https://github.com/forinda)! - Shared stores and imports in `<script>`. Island scripts can now `import` (hoisted to the top of the compiled modules; `node:` imports are a build error since the script is bundled for the browser). A store is a module exporting `state()` values; `let items = shared(store)` uses it in an island like local state, keeping every island that uses it in sync. On the server a shared value renders from the store's initial value, never its current one, so one request can't leak into another's page. Signals gain a read-only `initial`.

- [#59](https://github.com/forinda/clarusjs/pull/59) [`c529c90`](https://github.com/forinda/clarusjs/commit/c529c9039519a60c36061b4905daa5b03803bf1c) Thanks [@forinda](https://github.com/forinda)! - `verbatim` elements: add `verbatim` to any HTML element (for example `<pre><code verbatim>…</code></pre>`) and its content is shown as text, with no holes, tags or directives inside. Useful for code samples.

### Patch Changes

- [#64](https://github.com/forinda/clarusjs/pull/64) [`2d4e8b9`](https://github.com/forinda/clarusjs/commit/2d4e8b9ba2013339f2155e225d407f134c203314) Thanks [@forinda](https://github.com/forinda)! - URL checks now cover every entry of list-valued attributes: each space-separated URL of `ping`, and each `;`-separated entry of `values` on SVG animation elements. SVG animation attributes (`to`, `from`, `values`, `by`) are only URL-checked on `<animate>`, `<set>`, `<animateMotion>` and `<animateTransform>`; on other elements they are ordinary data.

- [#63](https://github.com/forinda/clarusjs/pull/63) [`cabb26b`](https://github.com/forinda/clarusjs/commit/cabb26b87179276b74c65d902f51ea1968b40931) Thanks [@forinda](https://github.com/forinda)! - Safer URL attributes: bound and interpolated URL attributes now use an allowlist (relative URLs, `http:`, `https:`, `mailto:`, `tel:`, and raster `data:` images for image attributes) instead of refusing only `javascript:`/`vbscript:`. More URL-bearing attributes are checked (`data`, `codebase`, `ping`, `manifest`, `longdesc`, SVG animation values), every `srcset` candidate is checked, and binding `srcdoc` is a build error.

## 0.2.0

### Minor Changes

- [#5](https://github.com/forinda/clarusjs/pull/5) [`0bec5ce`](https://github.com/forinda/clarusjs/commit/0bec5ceac79f30a327a8d3e301133cc8a9e890d8) Thanks [@forinda](https://github.com/forinda)! - Static sites: `vite build` now builds the client and server and prerenders every page to `dist/client/<route>/index.html`, and `vite preview` serves those pages at their routes. Stateless components can wrap content with a default `<slot />`, and a page whose layout renders `<html>` becomes the whole document (doctype added, island style and loader injected where they belong).

### Patch Changes

- [#5](https://github.com/forinda/clarusjs/pull/5) [`e3bc637`](https://github.com/forinda/clarusjs/commit/e3bc637077608edb36db950a92dca98290866ad6) Thanks [@forinda](https://github.com/forinda)! - The package now ships its own README, so the npm page shows install and usage instructions.

## 0.1.0

### Minor Changes

- [#1](https://github.com/forinda/clarusjs/pull/1) [`1c65b70`](https://github.com/forinda/clarusjs/commit/1c65b706ce27259a8cb1c26b46d64a87a178bcbc) Thanks [@forinda](https://github.com/forinda)! - First proof of concept: `.clarus` components compiled to server HTML with attach-only islands, compiled signals, an island loader, a `fetch(Request)` handler and a Vite plugin.

### Patch Changes

- [#3](https://github.com/forinda/clarusjs/pull/3) [`8792fc3`](https://github.com/forinda/clarusjs/commit/8792fc33356086bc77a26bb60263695f51aa2ce3) Thanks [@forinda](https://github.com/forinda)! - The published package now contains compiled JavaScript and type declarations (`dist/`) instead of TypeScript sources, so it works in any Node or Vite project without a TypeScript loader.

- [#2](https://github.com/forinda/clarusjs/pull/2) [`94823b2`](https://github.com/forinda/clarusjs/commit/94823b20303b836903079bd244f17a85ec60823b) Thanks [@forinda](https://github.com/forinda)! - Licensed under MIT; the package now includes the LICENSE file.
