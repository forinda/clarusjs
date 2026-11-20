# clarusjs

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
