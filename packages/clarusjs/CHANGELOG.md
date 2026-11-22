# clarusjs

## 0.11.0

### Minor Changes

- [#334](https://github.com/forinda/clarusjs/pull/334) [`d1aa9d1`](https://github.com/forinda/clarusjs/commit/d1aa9d1b8314d9c8541bcc2f4139e2e5f81077f1) Thanks [@forinda](https://github.com/forinda)! - Component loaders: a `.load.ts` next to a component (outside `src/pages`) loads that component's data. Before a page renders, every component loader it uses (however deeply nested) runs in parallel with the route's context (`params`, `request`, `cookies`, `locals`), then the page renders synchronously with the results, which fill each component's inputs (props from the parent win). Static pages run them at build, server routes per request; client routes don't support them yet (an error).

- [#313](https://github.com/forinda/clarusjs/pull/313) [`ece99b7`](https://github.com/forinda/clarusjs/commit/ece99b712d31942c13001003779bd337081bd094) Thanks [@forinda](https://github.com/forinda)! - `clarusjs({ compress: true })`: `vite build` writes `.br` and `.gz` next to each HTML, JS, CSS, SVG, JSON and XML file in `dist/client` (Node's `zlib`, no dependency), each kept only when smaller, for servers that serve precompressed files directly (nginx `gzip_static`/`brotli_static`, Caddy `precompressed`).

- [#327](https://github.com/forinda/clarusjs/pull/327) [`3ed3004`](https://github.com/forinda/clarusjs/commit/3ed3004422470311b0f88bd1dbf3d2f477e990bd) Thanks [@forinda](https://github.com/forinda)! - Cookies and locals in loaders, with a request hook: every `load()` gets `cookies` (`get`, `getAll`, `set`, `delete`; what's set goes on the answer as `Set-Cookie`, with secure defaults: `path: '/'`, `httpOnly`, `sameSite: 'lax'`, and `secure` everywhere but the Vite dev server) and `locals`. An optional `src/server.ts` exports `handle({ request, cookies, locals })`, run once per request before any page loads; returning a Response (such as `redirect('/login')`) answers instead. `Locals` is declared once with module augmentation and checked in every loader. New types: `LoadContext`, `Cookies`, `CookieOptions`, `Locals`, `Handle`.

- [#329](https://github.com/forinda/clarusjs/pull/329) [`061d0f7`](https://github.com/forinda/clarusjs/commit/061d0f79a60a7349ae1eb3785fcbf02fd93191e0) Thanks [@forinda](https://github.com/forinda)! - Endpoints: a `.ts` file under `src/pages` (not `.load.ts`) exporting `GET`, `POST`, `PUT`, `PATCH`, `DELETE` or `OPTIONS` handlers answers at its route, with the same context as `load()` (request, params, cookies, locals), served by the same handler in dev, preview and production (and the Netlify adapter). Cross-site writes are refused (403) by an `Origin` / `Sec-Fetch-Site` check; `HEAD` falls back to `GET`; other methods get 405 with `Allow`. Request bodies now reach the handler in dev and `vite preview`. New type: `RequestHandler`.

  The CSRF check falls back to `Referer` when a write has no `Origin`, refuses an opaque `Origin: null`, and refuses a write that carries cookies but neither header.

- [#336](https://github.com/forinda/clarusjs/pull/336) [`d4af927`](https://github.com/forinda/clarusjs/commit/d4af927b6a27a69339941aa480a471b55c273038) Thanks [@forinda](https://github.com/forinda)! - Island HMR in `vite dev`: saving an island's file swaps it in place with the page's new HTML and code, and its state (and that of islands inside it) carries over by name. Changes only the server sees, like pages, layouts, components without a `<script>`, loaders and Markdown pages, now reload the open page; before, the browser kept showing the old page. Builds carry none of it.

- [#328](https://github.com/forinda/clarusjs/pull/328) [`79315ea`](https://github.com/forinda/clarusjs/commit/79315ead6668ca60da0a280ae15abdd8f2e4082d) Thanks [@forinda](https://github.com/forinda)! - A static (or client) route's `load()` that reads `cookies` or the request's headers is now an error: "/account reads cookies, but static routes are built once for everyone: make it 'server'". Such a page used to be built once with whatever the build saw. `clarusjs explain` and `dist/clarusjs-manifest.json` (`cookies: true`) show which server routes read cookies.

- [#337](https://github.com/forinda/clarusjs/pull/337) [`aa69dae`](https://github.com/forinda/clarusjs/commit/aa69dae9a04403747a334a3c4b8f87985842a4f7) Thanks [@forinda](https://github.com/forinda)! - Template lint in `clarusjs check`: `unused-input`, `unused-import`, `img-alt`, `label-field` and `accessible-name`, reported as warnings at `file:line:col` (the exit code changes only with `--strict`, or a rule set to `'error'`). Set levels with the plugin's `lint` option, skip one place with `{{-- clarusjs-ignore rule --}}`, and add your own rules with `lintRules` (`lint()`, `lintRules` and `LintRuleDef` are exported from `clarusjs/compiler`). Every diagnostic now has a `severity`, also in `--json`. The language server shows the built-in rules' findings as warnings.

### Patch Changes

- [#313](https://github.com/forinda/clarusjs/pull/313) [`5d4d1ce`](https://github.com/forinda/clarusjs/commit/5d4d1ce3987f5a6742bae3c92e88f73397c5de0c) Thanks [@forinda](https://github.com/forinda)! - Full-document pages: a comment (or BOM) before the doctype no longer adds a second one, and `<html>`, `</head>` or `</body>` inside a `<script>` or `<style>` no longer count as the page's own tags (a page with one in an inline script got no default shell, or the loader in the wrong place).

- [#313](https://github.com/forinda/clarusjs/pull/313) [`16c619f`](https://github.com/forinda/clarusjs/commit/16c619fa42a7336c7a247fb125edbbb031445268) Thanks [@forinda](https://github.com/forinda)! - `vite build` no longer publishes Vite's manifest (`dist/client/.vite/manifest.json`) with the site. `vite preview` answers a malformed URL with 400 instead of passing it on, and its built-page lookup compares against the output folder with a separator, so a path into a sibling folder (`dist/clientx`) can't be mistaken for a page of the site.

- [#326](https://github.com/forinda/clarusjs/pull/326) [`29b7974`](https://github.com/forinda/clarusjs/commit/29b79748a27b0aa14aa26469481bc27ee0e993e7) Thanks [@forinda](https://github.com/forinda)! - `vite build --watch` works: after each change under `src/` or `public/`, the client build, the server build and the prerender run again in order, so pages point at the rebuilt islands' new hashes (it used to fail looking for the server build). In dev, island URLs use forward slashes on Windows, and `/@fs/` URLs for components outside the root carry the drive (`/@fs/C:/libs/c.tscl`).

## 0.10.0

### Minor Changes

- [#301](https://github.com/forinda/clarusjs/pull/301) [`efb8968`](https://github.com/forinda/clarusjs/commit/efb89684964711686781c7b4774f184b93f95f9f) Thanks [@forinda](https://github.com/forinda)! - Fields and attributes, checked against Vue's exceptions ([#241](https://github.com/forinda/clarusjs/issues/241)):

  - **`false` is now a value** on the enumerated `spellcheck`, `draggable` and `contenteditable` (and `translate`: yes/no), and on the ARIA states `aria-expanded`, `aria-pressed`, `aria-checked` and `aria-selected`. Before, `[aria-expanded]="false"` removed the attribute. Other attributes keep "false removes it".
  - **A field's `value` and `checked` are set last,** after `type`, `min`, `max` and `step`, so a browser doesn't clamp them.
  - **`[(value)]`:**
    - text fields don't write while an input method composes (IME);
    - number and range inputs write numbers;
    - checkboxes with a value bind an array (checked when it includes the value);
    - `<select multiple>` (static or `[multiple]`) binds an array of the selected values;
    - a bound `<select>`'s options render `selected` on the server, so the choice shows before any JavaScript (values compare as text);
    - a number field keeps what's being typed (`1.0` isn't rewritten to `1`);
    - a checkbox group bound to a missing array starts an empty one.

    Radio, checkbox and number bindings need a static `type`; with a bound `[type]` the field binds as text.

  - **Already right, now tested:** `form`, `list`, `width`/`height`, textarea `type`, and SVG attributes (case kept) are always attributes; `<option [value]>` works; a `null` value is an empty field.

- [#308](https://github.com/forinda/clarusjs/pull/308) [`40815e7`](https://github.com/forinda/clarusjs/commit/40815e7afe1d77a618ebb97e3216e89a354d332f) Thanks [@forinda](https://github.com/forinda)! - At `vite build`, each run of whitespace in template text becomes one character (a newline if it had one), so a formatted template's indentation stays out of the HTML. `<pre>`, `<textarea>`, `<script>`, `<style>`, `verbatim` contents and `{{ }}` values are untouched; `clarusjs({ collapseWhitespace: false })` turns it off. Also a `compile()` option, `collapseWhitespace`.

- [#290](https://github.com/forinda/clarusjs/pull/290) [`ff3b28c`](https://github.com/forinda/clarusjs/commit/ff3b28cf3b87ec28fd2f0c623a20cab7e2962ab3) Thanks [@forinda](https://github.com/forinda)! - `clarusjs/fetch` caches answers by key ([#287](https://github.com/forinda/clarusjs/issues/287)), for paginated lists and other data shown again and again:

  - `resource(fetcher, { key: () => ['items', { page }] })` shares one cache entry per key across the page's islands. A key seen before is served without a request until it's invalidated, or `stale` ms old. The previous value stays on screen while a new key loads. Requests for the same key at the same time share one request.
  - `invalidate(['items'])`: every cached answer whose key starts with that prefix is marked stale. The ones on screen refetch now; the others refetch when next used.
  - `setData(key, value | fn)` for optimistic edits, and `prefetch(key, fetcher)` for the next page.
  - An answer nothing shows is dropped after `keep` ms (default 5 minutes).

- [#286](https://github.com/forinda/clarusjs/pull/286) [`60852d9`](https://github.com/forinda/clarusjs/commit/60852d9afcfb60075bb5883df584ddbfb3baf1b9) Thanks [@forinda](https://github.com/forinda)! - `clarusjs/fetch`: data an island fetches itself, in the browser ([#258](https://github.com/forinda/clarusjs/issues/258)).

  - `resource(fetcher, options)` gives `value`, `loading`, `error`, `refetch()` and `mutate()`. It re-runs when a signal the fetcher reads changes, so requests chain. The latest run wins, and a disposed island aborts its run.
  - Options: retry with backoff; refetch on an interval or when the tab regains focus; a starting value from `load()`, revalidated in the browser unless `refetch: { onStart: false }`.
  - `batch(load)` sends the keys asked of one endpoint at the same moment, from any island, as one request.
  - `json(url)` throws on a non-2xx response.

  Nothing is fetched on the server. The entry stays within 2.5 KB gzip, and a page that doesn't import it ships none of it. See https://clarusjs.com/guide/fetching.

- [#301](https://github.com/forinda/clarusjs/pull/301) [`58fb1e6`](https://github.com/forinda/clarusjs/commit/58fb1e6affe9a17db0c365a33916c8b7c7779c2b) Thanks [@forinda](https://github.com/forinda)! - `@for` rows have `$count`, `$first`, `$last`, `$even` and `$odd` besides `$index` ([#249](https://github.com/forinda/clarusjs/issues/249)). In an island they follow the list: add a row, and the old last row isn't `$last` any more. Type checking knows them (`$count` a number, the others booleans).

  Clearer `@for` errors:

  - an item named like one of those names;
  - a second `track`;
  - a second `@empty`.

  An island `@for` without `track` now warns: rows are matched by position, so a row's state can move to another item. Matching by position on purpose? Write `track $index`. A script can't declare a variable named like one of the row names.

- [#301](https://github.com/forinda/clarusjs/pull/301) [`dcd5683`](https://github.com/forinda/clarusjs/commit/dcd5683000ea50a7b422ab812941fb501f258737) Thanks [@forinda](https://github.com/forinda)! - `h()` in `clarusjs/views` ([#259](https://github.com/forinda/clarusjs/issues/259)) builds HTML in server code from elements and views: for components picked at runtime, wrappers, generated layouts and tests (`h('components/card', { title }, [h('p', {}, ['Body'])])`).

  - Text is escaped and attributes are URL-checked, as in templates, and `h()` results nest.
  - A template's `{{ }}` inserts `h()` output as HTML; every other value is escaped as before.
  - Only `h()` can make that output (data such as JSON can't). It's for server-rendered pages: sending it in an island's props or a client route's data is an error naming it.
  - `on*` attributes, `srcdoc`, tags that load or run things, and clarusjs's own `cl-*` tags are refused from code. Take view and tag names from your own list, never from request data.

- [#301](https://github.com/forinda/clarusjs/pull/301) [`516a33c`](https://github.com/forinda/clarusjs/commit/516a33cc5ff28099d16ead9afafd058a820b499d) Thanks [@forinda](https://github.com/forinda)! - Radio groups bind two ways ([#267](https://github.com/forinda/clarusjs/issues/267)). `[(value)]` on `<input type="radio" value="pro">` is checked when the bound value equals the radio's value, and picking it writes that value: `plan: 'free' | 'pro'` binds to a group of radios, as Vue's `v-model` does. The value can be static or `[value]`. A bound radio without a value is a compile error. Type checking checks each radio's static value against the bound type.

- [#283](https://github.com/forinda/clarusjs/pull/283) [`24543cd`](https://github.com/forinda/clarusjs/commit/24543cdace11661cf56c96fa5ecc1be76a09a2cd) Thanks [@forinda](https://github.com/forinda)! - URLs that load a page, plugin, stylesheet or base URL into the page can't come from data ([#248](https://github.com/forinda/clarusjs/issues/248)). It is a located build error, like `srcdoc`:

  - `src` on `<iframe>`, `<frame>` and `<embed>`;
  - `data` and `codebase` on `<object>`;
  - `href` on `<base>`;
  - `href` on a `<link>`, unless its static `rel` loads nothing (`canonical`, `alternate`, `prev`, `next`…);
  - `sandbox`, `allow` and `referrerpolicy` on `<iframe>`.

  Write these as static attributes. Links and images from data are unchanged: they keep the URL check.

### Patch Changes

- [#295](https://github.com/forinda/clarusjs/pull/295) [`acedce0`](https://github.com/forinda/clarusjs/commit/acedce0ecd1d7140a119da47a140ac4857e143a9) Thanks [@forinda](https://github.com/forinda)! - Editor hovers for `clarusjs/compiler` (`compile()`, `parse()`, `ClarusError` and the syntax-tree types) and `@clarusjs/content` (`markdown()`, its options, `slugify()`): JSDoc with examples, linking new reference pages (https://clarusjs.com/reference/compiler, https://clarusjs.com/reference/content). Every public export of both packages is now documented.

- [#295](https://github.com/forinda/clarusjs/pull/295) [`69fa594`](https://github.com/forinda/clarusjs/commit/69fa5943f84c5386a340758836c7571608e7eab0) Thanks [@forinda](https://github.com/forinda)! - Editor hovers for `clarusjs/forms`: `form()` and its types (`Form`, `FormOptions`, `FormError`, `Path`, `StandardSchema`) now have JSDoc with an example and links to the new forms reference (https://clarusjs.com/reference/forms).

- [#295](https://github.com/forinda/clarusjs/pull/295) [`d99b7bc`](https://github.com/forinda/clarusjs/commit/d99b7bcf28d92f3714cb0095d860d533567c5db9) Thanks [@forinda](https://github.com/forinda)! - Editor hovers for `clarusjs/navigation`, `clarusjs/views` and `clarusjs/manifest`: every function has an example, and every export links to its section in the new navigation reference (https://clarusjs.com/reference/navigation) or the server reference (`render()`, `readManifest()` and their types). `Transition` and `HeadTag` are documented too.

- [#295](https://github.com/forinda/clarusjs/pull/295) [`435cbaa`](https://github.com/forinda/clarusjs/commit/435cbaa88a8bc16f7a9996d4ca1faf73ab0bd89e) Thanks [@forinda](https://github.com/forinda)! - Editor hovers for the runtime: `state`, `derived`, `shared`, `effect`, `batch`, `untrack`, `scope`, `onDispose`, `browser`, `Signal` and `ReadSignal` now have JSDoc, each with an example and a link to its section in the reference (https://clarusjs.com/reference/runtime). Helpers only compiled components call are marked `@internal`.

- [#295](https://github.com/forinda/clarusjs/pull/295) [`2574332`](https://github.com/forinda/clarusjs/commit/25743326322c9bc31f4da6e6c0301ed2df31b575) Thanks [@forinda](https://github.com/forinda)! - Editor hovers for `clarusjs/vite` and `clarusjs/server`: the plugin, its options, `LinkLevel`, the page-source types and `redirect()` now have JSDoc with examples and links to their reference sections. There's a new Server reference page (https://clarusjs.com/reference/server). Build and server internals are marked `@internal`.

- [#289](https://github.com/forinda/clarusjs/pull/289) [`3f6853c`](https://github.com/forinda/clarusjs/commit/3f6853c795dedbabed1d776ead9f56b3961b49e5) Thanks [@forinda](https://github.com/forinda)! - An `await` (or `for await`) at the top level of a component's `<script>` is now a compile error with its place. Before, it compiled into JavaScript that doesn't run, because `render()` and `attach()` are synchronous. Await inside a function instead, such as a resource's fetcher or an event handler.

## 0.9.0

### Minor Changes

- [#257](https://github.com/forinda/clarusjs/pull/257) [`7a38592`](https://github.com/forinda/clarusjs/commit/7a385924e5900383ee9219f7e36d999e3b74591e) Thanks [@forinda](https://github.com/forinda)! - `browser` from `clarusjs/runtime`: true in the browser, false on the server, for the parts of a component's script that only make sense where it attaches (timers, listeners on `window`, the DOM). Replaces `typeof window !== 'undefined'`; a window without a document (some server runtimes define one) counts as the server.

- [#281](https://github.com/forinda/clarusjs/pull/281) [`80f961c`](https://github.com/forinda/clarusjs/commit/80f961cf0963e42508eabbc23b4cd1ec8e05041b) Thanks [@forinda](https://github.com/forinda)! - `class="…"` on a component tag passes through to the component's top-level elements, after their own class and the scope class, so a parent's `<style scoped>` can style it ([#279](https://github.com/forinda/clarusjs/issues/279)). Islands keep it when they re-render a block in the browser. Only a static `class` for now: `[class]` or `{{ }}` in it on a component is a located error.

- [#234](https://github.com/forinda/clarusjs/pull/234) [`7009b8c`](https://github.com/forinda/clarusjs/commit/7009b8cc7bf75ebe2dfdefae9d87c31eb824f297) Thanks [@forinda](https://github.com/forinda)! - A TypeScript 7.1 content mapper for `.tscl` files: add `"contentMappers": [{ "package": "clarusjs", "extensions": [".tscl"] }]` to `tsconfig.json`, and TypeScript (in VS Code, or `tsc --runExternalCode`) checks templates as you type, with errors, hover and completion in the template. It runs as `clarusjs mapper`. Template type checking (here and in `clarusjs check`) also types the untyped parameters of a script's own functions as `any`, so strict projects don't flag them.

- [#261](https://github.com/forinda/clarusjs/pull/261) [`ddcf28b`](https://github.com/forinda/clarusjs/commit/ddcf28b1b996a833007f1c49de4f52f886b2b9f7) Thanks [@forinda](https://github.com/forinda)! - `clarusjs/forms`: a headless forms engine. `const f = form(values, { schema, show, messages })` over a component's state or a store; `<form [engine]="f">` connects it. Every field's error (native constraints, a Standard Schema, server errors via `f.setErrors`) shows in its `[data-cl-message]` element, with `aria-invalid` and `aria-describedby`, without naming the path in the template. `f.error(path)`, `f.errors`, `f.touched`, `f.changed`, `f.valid`, `f.pending`, `f.focus`, `f.reset`; paths are type-checked. The compiler marks every `[(value)]`/`[(checked)]` with `data-cl-path`.

- [#268](https://github.com/forinda/clarusjs/pull/268) [`5fffc7d`](https://github.com/forinda/clarusjs/commit/5fffc7d28f5e50664a4b81f2e189fa5d59a47ce3) Thanks [@forinda](https://github.com/forinda)! - `clarusjs/forms`: `f.reset(values)` sets new values and makes them the starting point (a record loaded after the form was made, or saved and reloaded), so `f.changed()` and `f.reset()` compare against it. Also: `[engine]` connects its own element inside `@for` rows and next to nested islands (the same lookup reactive attributes use, now shared as `marked()` in the runtime); a form's pending schema check stops when its last island goes; a form made over a store's signal is inert on the server.

- [#262](https://github.com/forinda/clarusjs/pull/262) [`4c40fa8`](https://github.com/forinda/clarusjs/commit/4c40fa80fe2f57c425d7c1d569c132aa078eec6c) Thanks [@forinda](https://github.com/forinda)! - `clarusjs/forms`: multi-step forms on one page. Sections marked `data-cl-step` with an `id` are shown one at a time, with the current one in the URL hash (Back/Forward and reload land on it; other hashes, like heading anchors, leave the form alone). `f.next()` checks the current step and stays with the first error focused, `f.back()` never checks, `f.go(id)`, `f.step`, and `f.steps` (current, done, errors per step) for a step list. `f.focus(path)` opens the step holding the field.

- [#263](https://github.com/forinda/clarusjs/pull/263) [`54297d3`](https://github.com/forinda/clarusjs/commit/54297d34a7003649a211a7bf2c16c830751da898) Thanks [@forinda](https://github.com/forinda)! - `clarusjs/forms`: submit takes you to the errors. A connected `<form>`'s submit (or `f.submit()`) checks everything, waits for the schema, and with errors goes to the step of the first one, focuses its field and shows them all (`f.errors` lists them with their message ids, for a summary). Otherwise it calls `submit(values)`; server errors it returns (`{ errors: { path: message } }`) land the same way. One submit at a time (`f.submitting`); `show: 'submit'` keeps errors hidden until the first one.

- [#271](https://github.com/forinda/clarusjs/pull/271) [`ade6f06`](https://github.com/forinda/clarusjs/commit/ade6f0677169a74ff2c4c4f5204bd4d7ecb45067) Thanks [@forinda](https://github.com/forinda)! - `parse` (and the `ParsedFile`, `InputDecl`, `ImportDecl`, `TemplateNode`, `Attr` types) from `clarusjs/compiler`, so tools such as a language server can read a `.tscl` file's syntax tree.

- [#280](https://github.com/forinda/clarusjs/pull/280) [`bcbda7d`](https://github.com/forinda/clarusjs/commit/bcbda7da92db7c10d823949d5f4fc8c2d2049cad) Thanks [@forinda](https://github.com/forinda)! - Explicit `<style scoped>` and unique scope classes ([#279](https://github.com/forinda/clarusjs/issues/279)).

  - **Breaking:** a plain `<style>` is now global, plain CSS. Add `scoped` to keep a component's styles scoped to it. For now the compiler warns about a plain `<style>`, with its place; write `<style global>` to keep one global without the warning.
  - Every component's top-level elements carry a class unique to the component (`cl-c-<name>-<hash>`), merged with their own `class`. It replaces the `data-cl-c` attribute. `cl-c-` is a reserved class prefix.
  - A parent's `<style scoped>` styles a child component's top-level element (by its class or tag), but not its inside. Parent rules no longer leak into a child component that has no `<style>` of its own.
  - `compile()` returns `warnings`, located `ClarusError`s that aren't thrown. The Vite plugin prints them once per file.

### Patch Changes

- [#224](https://github.com/forinda/clarusjs/pull/224) [`bf8c684`](https://github.com/forinda/clarusjs/commit/bf8c68430cd3f122c48403061e78362626cb9b51) Thanks [@forinda](https://github.com/forinda)! - `clarusjs check`: `$event` for an event name the DOM doesn't know (a custom event like `(rate)`) is a `CustomEvent`, so `$event.detail` checks; and `state([])` starts an array of anything instead of `never[]` (scripts are JavaScript, so there is no `state<string[]>([])`).

- [#212](https://github.com/forinda/clarusjs/pull/212) [`61a3ffd`](https://github.com/forinda/clarusjs/commit/61a3ffd3410ebe589c7fb29f1249b59a08a16620) Thanks [@forinda](https://github.com/forinda)! - `clarusjs check` covers page sources: it reads the clarusjs plugin's `sources` (Markdown pages from `@clarusjs/content`) and `resolve.alias` from the app's Vite config. A component used in a `.md` page is checked like in a `.tscl` page, with errors at `page.md:line:col`; a page source's `.load.ts` is paired with it, and its views are in `.clarusjs/views.d.ts`. Root paths (`/src/…`) resolve as in Vite.

- [#245](https://github.com/forinda/clarusjs/pull/245) [`e56bbc1`](https://github.com/forinda/clarusjs/commit/e56bbc16eaa243909a6a571d7bffb44a5bd6ece3) Thanks [@forinda](https://github.com/forinda)! - Type checking (`clarusjs check` and the content mapper): `[attr]="…"` on an element is checked against what it sets. A boolean attribute (by the DOM's own types: `disabled`, `readonly`, `hidden`, …) takes a boolean, since any string, even `'false'`, switches it on; any other attribute takes a string, number, boolean or null, since an object would render as `[object Object]`.

- [#264](https://github.com/forinda/clarusjs/pull/264) [`82b7f6f`](https://github.com/forinda/clarusjs/commit/82b7f6f9e99bdd8c0691509e56ff7e5db8d4d3ba) Thanks [@forinda](https://github.com/forinda)! - `clarusjs/forms`: a field's message element is found in the nearest container around it that has one, so it can sit beside the label (`<div data-cl-field><label>…</label> <input …> <small data-cl-message></small></div>`) instead of inside it, where it would be read as part of the field's name. `f.errors` paths are typed, so a summary can pass them to `f.focus()`.

- [#266](https://github.com/forinda/clarusjs/pull/266) [`a9f2c81`](https://github.com/forinda/clarusjs/commit/a9f2c8181a68b9afd51f0cb9e71a2efdacc9a02e) Thanks [@forinda](https://github.com/forinda)! - `clarusjs/forms` fixes from review:
  - Errors on paths no field shows (a whole-object schema rule, a server error like `{ '': 'Server down.' }`) stop submit and are listed in `f.errors` (with no id or step), instead of being dropped.
  - `f.next()` and `f.submit()` wait for the newest schema check (a pending pause is cut short), so a slow async rule can't be skipped; a schema that throws no longer leaves `f.pending` stuck.
  - A field without its own `[data-cl-message]` no longer takes another field's.
  - Touched state follows the row, not its index: removing a touched row doesn't show the next row's error.
  - Back to the page as it loaded (no hash) shows the first step.

- [#256](https://github.com/forinda/clarusjs/pull/256) [`bb0f81f`](https://github.com/forinda/clarusjs/commit/bb0f81fd490e72c3b29cf4bb44a7df2cf54482c2) Thanks [@forinda](https://github.com/forinda)! - Type checking (`clarusjs check` and the content mapper):
  - An event handler or two-way binding inside `@if (x)` keeps that narrowing (`x` was "possibly null" inside a `(click)` handler); `@else` branches know the earlier conditions were false.
  - `$event.currentTarget` is the element the handler is on (`HTMLInputElement` for `<input (input)>`).
  - No errors from generated code under `noUnusedLocals` (unread inputs, `$index`, helper types).

- [#216](https://github.com/forinda/clarusjs/pull/216) [`358f9ae`](https://github.com/forinda/clarusjs/commit/358f9ae3a087fa6ab5193f61151223dd998e81f1) Thanks [@forinda](https://github.com/forinda)! - Types in a `.tscl` file: `@type Name<T> = …` and `@interface Name<T> extends … { … }`, for the file's `@input` props. Any TypeScript type (unions, generics with defaults, mapped and conditional types, `infer`), continuing onto following lines while a bracket is open. Erased from compiled output; checked by `clarusjs check`, with errors at their line. Local to the file: other files see them only through the component's inputs.

  `@input` types and defaults can span lines too (an object type, a default object), and function types keep their `=>`: `@input onPick: (id: string) => void` (the `=` of `=>` was read as the start of a default).

- [#244](https://github.com/forinda/clarusjs/pull/244) [`44fd0fb`](https://github.com/forinda/clarusjs/commit/44fd0fb0c373a758c0ac99548f47563696a6fbc0) Thanks [@forinda](https://github.com/forinda)! - Content mapper: an error on a whole construct underlines all of it (a missing prop underlines `<card`, a two-way binding check `[(open)]`), not one character; and generated stand-ins (`__cl_p`) take no part in hover, completion or rename.

- [#222](https://github.com/forinda/clarusjs/pull/222) [`12b8958`](https://github.com/forinda/clarusjs/commit/12b8958c3880e2d5017c0fd3179c20f0708ad5a1) Thanks [@forinda](https://github.com/forinda)! - Two-way binding into lists: `[(value)]="rows[$index].name"` writes back copy-on-write (`rows = rows.map(…)`), so a field in a `@for` row updates the list. Binding to the row variable itself (`[(value)]="row.name"`), which only changed the row's copy, is now a located error pointing to the index form.

- [#215](https://github.com/forinda/clarusjs/pull/215) [`349cbd7`](https://github.com/forinda/clarusjs/commit/349cbd7be506893b0da3a698fc2b6868bd051861) Thanks [@forinda](https://github.com/forinda)! - `clarusjs check` reports an unknown prop on a component that declares no `@input` (it was accepted silently), as it already did for components with inputs; `render()` from `clarusjs/views` checks the same.

- [#223](https://github.com/forinda/clarusjs/pull/223) [`0138f4c`](https://github.com/forinda/clarusjs/commit/0138f4c5614351597701ff76e75eb619fa0f57ff) Thanks [@forinda](https://github.com/forinda)! - Event bindings for events that don't bubble work: `(mouseenter)`, `(mouseleave)`, `(pointerenter)`, `(pointerleave)`, `(load)`, `(error)`, `(scroll)`, `(toggle)`, `(invalid)`, `(close)`, `(cancel)` and media events are caught in the capture phase, like `(focus)` and `(blur)` already were.

- [#218](https://github.com/forinda/clarusjs/pull/218) [`0d40714`](https://github.com/forinda/clarusjs/commit/0d40714ab77e0cad96f861f5dcdd35567b797b19) Thanks [@forinda](https://github.com/forinda)! - Inputs are read-only and reactive, like `derived()`. In an island, each input is a read-only signal: holes, `@if`/`@for`, effects and `derived()` that read it update when it changes. A nested island whose parent island passes it new props gets them in place (its DOM and `state()` are kept) instead of being re-rendered. Assigning to an input is a compile error at its line (copy it to change it locally: `let local = state(count)`), and `clarusjs check` types inputs as deeply read-only, so changing anything inside one is a type error; a component's props accept read-only values.

- [#231](https://github.com/forinda/clarusjs/pull/231) [`048b058`](https://github.com/forinda/clarusjs/commit/048b05807649e2fdce117e9f4d27c1b9a7f5c37a) Thanks [@forinda](https://github.com/forinda)! - Fixes from review:
  - `[(value)]="form['name']"` updates an object property (a bracket path used to assume an array).
  - A destructuring write to an input (`({ value } = …)`) is a located read-only error.
  - A multi-line generic type (`Array<` across lines) stays inside its `@type`.
  - `(mouseenter)` and other events that don't bubble run only their target's handler, not an ancestor's.
  - A `@model` write is taken only by the island that binds that child, not by an outer one.
  - A nested island is kept in place only for the same component source.
  - New props are applied together (a new `batch()` in `clarusjs/runtime`), so effects never see half an update.
  - `clarusjs check`: works through a symlinked project root; resolves aliased component imports (outside the project, and exact aliases to a `.tscl` file); checks that a child's `@model` type can be written back into the parent's target.

- [#233](https://github.com/forinda/clarusjs/pull/233) [`983bd03`](https://github.com/forinda/clarusjs/commit/983bd03934fdeadb199f65f56e198bbfd8f0b6f2) Thanks [@forinda](https://github.com/forinda)! - Fixes from review:
  - Forms: a component bound two ways more than once carries a path per binding (`data-cl-path-<model>` on its island; its own fields write `@<model>`), so each binding's errors reach its field. A literal key (`order['email']`) is decoded in the path. `form` imported under another name keeps its state, and a local named `form` is left alone. A schema that throws blocks submit. Values changed during a check are checked again before submit; `next()` checks the step's fields as they are after waiting; server errors for values changed while the server answered are dropped.
  - Type checking: enumerated attributes (`draggable`, `spellcheck`, `translate`) take their strings; a condition about an outer name isn't repeated inside a `@for` whose item has that name.

- [#269](https://github.com/forinda/clarusjs/pull/269) [`6975d9e`](https://github.com/forinda/clarusjs/commit/6975d9eac1c7ebb3c8f0172ad43accb540a5260a) Thanks [@forinda](https://github.com/forinda)! - Type checking: a callback is typed `any` only when passed to one of the script's own top-level functions (not a nested function that happens to share an imported name), and not when that parameter has a default, which gives the callback its type.

- [#235](https://github.com/forinda/clarusjs/pull/235) [`f6cbb76`](https://github.com/forinda/clarusjs/commit/f6cbb769244967f587dd52f38c977de0df89562f) Thanks [@forinda](https://github.com/forinda)! - The theme's templates type-check under strict TypeScript with the content mapper: its config types take readonly lists (a template's inputs are readonly, and mutable configs still fit), and its scripts narrow DOM lookups instead of assuming elements exist. Template type checking also types callbacks passed to a script's own functions (`record((p) => …)`) as `any`, like those functions' own parameters.

- [#246](https://github.com/forinda/clarusjs/pull/246) [`63a125b`](https://github.com/forinda/clarusjs/commit/63a125b6ba20497904b80143d8eb4d2d77322d51) Thanks [@forinda](https://github.com/forinda)! - Content mapper: a template that doesn't parse (an unclosed `@if`, `<div>` or `{{` while you type) still gives TypeScript for the rest of the file, so hover, completion and type errors keep working in the editor; the syntax error is reported as before. The build and `clarusjs check` stay strict.

- [#221](https://github.com/forinda/clarusjs/pull/221) [`3c42922`](https://github.com/forinda/clarusjs/commit/3c42922919566d8ed62e3254beacf10dc8d2a9f8) Thanks [@forinda](https://github.com/forinda)! - Two-way binding. `[(value)]="form.name"` on an `<input>`, `<textarea>` or `<select>` (and `[(checked)]` on a checkbox) shows a value and writes it back, copy-on-write (`form = { ...form, name: value }`), so a previous state is just the old value. On a component, `[(x)]` binds its `@model x` input, the one kind of input a component may write: the write goes to the parent island (a `cl:model` event), which updates its state and passes the value back in place; with no parent binding it, the component keeps the value. `clarusjs check` requires `@model x` for `[(x)]` and a writable target. A reactive `[value]`/`[checked]` binding now also sets the property, so a field shows it after someone has typed.

## 0.8.1

### Patch Changes

- [#198](https://github.com/forinda/clarusjs/pull/198) [`d3bfcad`](https://github.com/forinda/clarusjs/commit/d3bfcad7719f50e55599f357d59196489b0e2018) Thanks [@forinda](https://github.com/forinda)! - Production builds leave out the development-only `@for` duplicate-key warning (it is behind `import.meta.env?.DEV`). The package declares `sideEffects`: only the loader, router, fragment navigation and `clarusjs/navigation` run code when loaded, so bundlers drop unused runtime modules.

- [#209](https://github.com/forinda/clarusjs/pull/209) [`6faf6b2`](https://github.com/forinda/clarusjs/commit/6faf6b20fe62ee764e27f483031b7c84308a73a4) Thanks [@forinda](https://github.com/forinda)! - `clarusjs check` uses a JavaScript project's `jsconfig.json` like a `tsconfig.json`.

- [#204](https://github.com/forinda/clarusjs/pull/204) [`4d478ed`](https://github.com/forinda/clarusjs/commit/4d478edd0bb5b45e59a5943c1d0ef080847252c9) Thanks [@forinda](https://github.com/forinda)! - A client route whose first render fails shows the site's 404 or 500 page (`src/pages/404.tscl`, `500.tscl`) at the same URL, with its islands and stylesheets (the shell links them). Without one, it shows "Could not load page." (also for a missing page, which said "Page not found." before).

- [#201](https://github.com/forinda/clarusjs/pull/201) [`74ab408`](https://github.com/forinda/clarusjs/commit/74ab408acca5be012886e1e3c3b375c9c403da6d) Thanks [@forinda](https://github.com/forinda)! - Error pages. When a page rendered on request fails (its `load()` throws or it can't render), the answer is the site's `src/pages/500.tscl` with status 500 (it gets a `status` input), or plain text without one; the error only goes to the server log. Builds also write `500.html` (left out of the sitemap). In development, the dev server shows the error itself with its stack instead.

- [#206](https://github.com/forinda/clarusjs/pull/206) [`a293c0a`](https://github.com/forinda/clarusjs/commit/a293c0a5f0eab6971cb8d3336542c3d40115bd47) Thanks [@forinda](https://github.com/forinda)! - Navigation fixes from review:
  - a navigation cancelled before it starts (a `beforeNavigate` hook) no longer leaves `data-cl-navigating` set or sends a later history change to the cancelled URL;
  - a failure before the URL changed is reported with the error itself, and the normal page load starts after that;
  - `afterSwap` and `afterNavigate` run once the new page's islands that attach right away are attached;
  - `onNavigateError` gets the page it was going to;
  - a hook whose island was released by an earlier hook is skipped;
  - the 500 page keeps `status` when it has its own `load()`;
  - a redirect whose file would replace a generated page or data file, or land outside the site, fails the build;
  - the browser runtime typechecks from source without an `ImportMeta.env` declaration.

- [#200](https://github.com/forinda/clarusjs/pull/200) [`bc20690`](https://github.com/forinda/clarusjs/commit/bc206903ee8c01a8292788fd8443c47656f57742) Thanks [@forinda](https://github.com/forinda)! - Aborting a navigation. `abort()` in `clarusjs/navigation` stops the navigation in progress, like the browser's stop button. Push and replace navigations now hold the URL while the next page loads where the browser supports it (precommit handlers): the address bar changes once the page is ready to swap in, so an abort leaves page and URL as they were (elsewhere the URL changes at once, as before). Fragment and `__data.json` requests get the navigation's abort signal, so a stopped or superseded navigation stops downloading. A page's own `replaceState` while a held navigation loads no longer loses the clicked page.

- [#188](https://github.com/forinda/clarusjs/pull/188) [`c80ed74`](https://github.com/forinda/clarusjs/commit/c80ed74fdf7163b0be9d9e3b5e4d1b9af0f38df2) Thanks [@forinda](https://github.com/forinda)! - Navigation hooks in `clarusjs/navigation`: `beforeNavigate` (can cancel), `afterNavigate` and `onNavigateError`, released with the island that registered them. A failed fragment swap or client render is now reported as `navigateerror` before the page loads normally.

- [#187](https://github.com/forinda/clarusjs/pull/187) [`9ffaf94`](https://github.com/forinda/clarusjs/commit/9ffaf942bc3ebcee32265a61ada1c2502118c7c5) Thanks [@forinda](https://github.com/forinda)! - New entry `clarusjs/navigation` for islands: `navigate(to, { replace, state })` and `back()` move between pages through the page's navigator (fragments or the client router, as a link click would), and `currentUrl` is the current URL as a store (`let here = shared(currentUrl)`; `null` on the server). Without the Navigation API, `navigate()` is a normal page load. Ships only with islands that import it.

- [#190](https://github.com/forinda/clarusjs/pull/190) [`e3392ef`](https://github.com/forinda/clarusjs/commit/e3392ef39bee3c5de3d548029b37b1bdcf8e5cd9) Thanks [@forinda](https://github.com/forinda)! - Transitions: every page change the router or fragment navigation takes over goes through `loading` then `swapping`, shown on `<html data-cl-navigating>` for CSS. In `clarusjs/navigation`: the `navigating` store, and the in-between hooks `beforeSwap` (the next page is loaded, this one still shown) and `afterSwap` (the new page is in). Hooks may return a promise, which the page change waits for; `t.signal` aborts when a newer navigation takes over.

- [#210](https://github.com/forinda/clarusjs/pull/210) [`83383ad`](https://github.com/forinda/clarusjs/commit/83383adb2c8e42a3f7e078f6cc83ddb4012061dd) Thanks [@forinda](https://github.com/forinda)! - Path aliases. `~/` is `src/`, built in. Aliases from `tsconfig.json`/`jsconfig.json` `paths` and Vite's `resolve.alias` work in `@import` (components, data, stylesheets), island scripts and `.load.ts` files, resolved the same way in dev, build, prerender and `clarusjs check` (which no longer drops the project's `paths`). An import that no file, package or alias matches is an error at its `@import` (`file.tscl:line:col`).

- [#195](https://github.com/forinda/clarusjs/pull/195) [`005cd31`](https://github.com/forinda/clarusjs/commit/005cd3123bffa1281d868138c3687648cc8107eb) Thanks [@forinda](https://github.com/forinda)! - Redirects. A server page's `load()` can return a `Response`, such as `redirect('/login')` from `clarusjs/server` (302 by default; 301, 303, 307 or 308). Fragment navigation and the client router follow it by loading the page normally, so the address bar shows where it landed. The plugin's `redirects: { '/old': '/new' }` writes a forwarding page at each old path and `_redirects` lines (a real 301 on Netlify and Cloudflare Pages), and the dev server answers 301; old paths pass the link check, and a redirect from a path that is a page is a build error.

- [#177](https://github.com/forinda/clarusjs/pull/177) [`2b38609`](https://github.com/forinda/clarusjs/commit/2b386098bb8919ad6c9af3fa26e3f78fbb434dde) Thanks [@forinda](https://github.com/forinda)! - The client router leaves the page's own `history.pushState` and `replaceState` alone: they no longer re-render the route (which lost focus and state and fetched `__data.json` again). Back and forward still render, and a `replaceState` while the next page loads still shows that page.

- [#186](https://github.com/forinda/clarusjs/pull/186) [`770e109`](https://github.com/forinda/clarusjs/commit/770e109ff0a8c278a43ba7a8958e2b7a4af2a18e) Thanks [@forinda](https://github.com/forinda)! - The client router and fragment navigation decide which navigations to take over in one shared place. Behaviour is unchanged; each script carries its own copy, so pages load no extra file.

- [#208](https://github.com/forinda/clarusjs/pull/208) [`e5c8f93`](https://github.com/forinda/clarusjs/commit/e5c8f93503049adcf11428090d15d11bac2ad2c9) Thanks [@forinda](https://github.com/forinda)! - Typed routes: `href(route, params)` from `clarusjs/navigation` builds a page's URL from its route (`'/releases/[version]'`), with params encoded and the site's base. `clarusjs check` writes `.clarusjs/routes.d.ts` (every page under `src/pages`, Markdown pages too), so a route that doesn't exist or a missing param is a type error.

- [#207](https://github.com/forinda/clarusjs/pull/207) [`b2a4aba`](https://github.com/forinda/clarusjs/commit/b2a4aba280288fa978f60432db67a71763d45e13) Thanks [@forinda](https://github.com/forinda)! - View transitions: `viewTransitions()` from `clarusjs/navigation` runs page changes (fragment swaps and client routes) inside `document.startViewTransition` where the browser has it; elsewhere they stay instant. `beforeSwap` runs before the browser's snapshot, `afterSwap` once the new page is in.

## 0.8.0

### Minor Changes

- [#151](https://github.com/forinda/clarusjs/pull/151) [`ed45e75`](https://github.com/forinda/clarusjs/commit/ed45e7503b0769cf6f15606e1764b205ec37c035) Thanks [@forinda](https://github.com/forinda)! - Focus and announcements on navigation. After a fragment swap or a client route render, focus moves to the new content: the `#hash` target, else the page's `<h1>`, else `<main>`. The new title is announced in a polite live region. The router and the navigation script stay within their 1 KB budgets: the work is in the loader.

- [#144](https://github.com/forinda/clarusjs/pull/144) [`1697023`](https://github.com/forinda/clarusjs/commit/1697023ecd5015f40f4ea7ad6a68777d05afd16a) Thanks [@forinda](https://github.com/forinda)! - Every page's `<head>`:

  - `head: { titleTemplate, tags, jsonLd }` in the plugin. `titleTemplate` (`%s · Site`) wraps each title, client routes included. `tags` (`[tag, attrs, content?]`) go on every page, for example icons, theme colour or analytics scripts such as gtag. `jsonLd` is site-wide schema.org data.
  - `<cl-head>…</cl-head>` anywhere in a page adds tags to its `<head>`. They win over site tags with the same key (title, meta name/property, canonical…), and a `<title>` there is used as written.
  - `transformHead(head, page)` exported from `src/head.ts` runs last on every page.
  - JSON-LD in templates: `<script type="application/ld+json">{{ { "@type": "Article", headline: title } }}</script>` writes the value as JSON that is safe inside the script.

- [#162](https://github.com/forinda/clarusjs/pull/162) [`5c0509e`](https://github.com/forinda/clarusjs/commit/5c0509e91117e7f8931e46cd939cb6d4c64e1514) Thanks [@forinda](https://github.com/forinda)! - Components from packages: `@import x from 'some-package/x.tscl'` works like a component in `src/`. clarusjs follows `@import` lines into packages, so their islands get client chunks and their scoped styles are bundled, in dev and build. Packages that ship `.tscl` files are bundled for server rendering.

- [#149](https://github.com/forinda/clarusjs/pull/149) [`e55fc99`](https://github.com/forinda/clarusjs/commit/e55fc99a48e30153bcb33aad6747f39d19ab8ad6) Thanks [@forinda](https://github.com/forinda)! - `robots.txt` and a 404 page.

  - With `site` set, `vite build` writes `robots.txt` that allows all crawlers and points at the sitemap. A `public/robots.txt` of your own wins, and `robots: false` turns it off.
  - `src/pages/404.tscl` (or `404.md`) is served for unknown addresses with status 404 in dev, in server mode and in `vite preview`.
  - `vite build` writes it to `404.html` for static hosts. Its relative links are resolved from the site root, so they work at any depth, and it is never in the sitemap.

- [#148](https://github.com/forinda/clarusjs/pull/148) [`45411d7`](https://github.com/forinda/clarusjs/commit/45411d706122449664cedd94cdfda9b6e0ed1ee9) Thanks [@forinda](https://github.com/forinda)! - Sitemap exclusions: `sitemap: { exclude: ["/drafts/**", "/tags/*", "/legal"] }` leaves pages out by path (`*` is one segment, `**` any depth). A page leaves itself out with `<cl-head><meta name="sitemap" content="false"></cl-head>`, and the marker is removed from the built page.

- [#148](https://github.com/forinda/clarusjs/pull/148) [`02ff969`](https://github.com/forinda/clarusjs/commit/02ff969e791e771a307b3f57dd4043136edf4e16) Thanks [@forinda](https://github.com/forinda)! - Sitemap: with `site` set, `vite build` writes `sitemap.xml` listing every prerendered static page. Client and server routes, data files, fragments and `noindex` pages are left out. Each page's `lastmod` is its source file's last commit, read with one batched `git log`. Files git doesn't know use `SOURCE_DATE_EPOCH`, or get no date. `sitemap: false` turns it off.

- [#147](https://github.com/forinda/clarusjs/pull/147) [`f6d35df`](https://github.com/forinda/clarusjs/commit/f6d35dfe7184d261ffe6ad8f02eb4b1403862527) Thanks [@forinda](https://github.com/forinda)! - Canonical URLs and social cards: with `site: { url, name?, image? }`, every page gets `<link rel="canonical">` and Open Graph/Twitter tags (title without the template, description, url, type, site name, image as an absolute URL, card type). They fill in like site tags, so a page's own tags win. Without `site`, a relative `og:image` or `og:url` fails the build instead of shipping a broken card. Link checking also checks absolute links to the site itself. The published JavaScript no longer carries source comments (the declarations and the browser runtime keep theirs), which keeps the package small.

- [#155](https://github.com/forinda/clarusjs/pull/155) [`c0e086e`](https://github.com/forinda/clarusjs/commit/c0e086e4c4d7776e4d7d24f578661f2c9fe49318) Thanks [@forinda](https://github.com/forinda)! - Tailwind CSS v4 works with its official Vite plugin, with no extra setup. Component `<style>` blocks can start with `@reference` (for `@apply`) or `@import`. Those statements are kept outside the component's `@scope` block, and their relative paths still resolve from the component file.

### Patch Changes

- [#165](https://github.com/forinda/clarusjs/pull/165) [`350d421`](https://github.com/forinda/clarusjs/commit/350d421f6f07de6567ad785e737e287f6107b1ed) Thanks [@forinda](https://github.com/forinda)! - `gitDates(root, dir)` is exported from `clarusjs/vite`: the newest commit time of every file under a folder, from one `git log` (the sitemap's dates), for themes and plugins.

- [#168](https://github.com/forinda/clarusjs/pull/168) [`c37358e`](https://github.com/forinda/clarusjs/commit/c37358e587c632c56e1b51e5fc4c6fc79e69225c) Thanks [@forinda](https://github.com/forinda)! - Fragment navigation no longer turns a page's own `history.pushState` / `replaceState` into a page load (it refetched the fragment and moved focus). Back and forward still swap pages, and a `replaceState` that interrupts a page still loading shows that page.

## 0.7.0

### Minor Changes

- [#130](https://github.com/forinda/clarusjs/pull/130) [`85095f8`](https://github.com/forinda/clarusjs/commit/85095f8a693527363d079b18c70eeb6cadf91110) Thanks [@forinda](https://github.com/forinda)! - Stylesheet imports and per-page CSS: `@import './x.css'` (no name) in a page or component declares a stylesheet it needs. Each goes through Vite's CSS pipeline (PostCSS or Lightning CSS, minified and hashed), and each page links exactly the stylesheets it imports directly or through its components, dependencies first, before the component styles. Client-route shells link every client page's stylesheets; fragments carry their page's links, and fragment navigation adds and waits for any that are missing. The client router now keeps the head across navigations (it updates the title and `<html>` attributes and runs the new page's inline head scripts), so linked stylesheets stay.

- [#130](https://github.com/forinda/clarusjs/pull/130) [`d049888`](https://github.com/forinda/clarusjs/commit/d0498884f0bdb226fd1643ef6ceb8bfbdba36ba6) Thanks [@forinda](https://github.com/forinda)! - `<script inline>`: a script written into the page as is (static attributes only; its content is never a template) and run where it stands, such as at the top of `<head>` to apply a saved theme before the first paint. The client router now runs the rendered page's inline head scripts, as a normal load would, and the island style is installed on the document by the loader so it survives head swaps.

- [#139](https://github.com/forinda/clarusjs/pull/139) [`ea27476`](https://github.com/forinda/clarusjs/commit/ea274768707c611d1c321ca6e70e3fd1c776deb7) Thanks [@forinda](https://github.com/forinda)! - Build-time link checking: once every page is built, links to pages and files that don't exist fail the build, and links to a missing `#anchor` warn, each with the source file and line and a "did you mean" suggestion. Configure with `links: { pages, anchors, strict }` (`error`, `warn` or `off`).

- [#135](https://github.com/forinda/clarusjs/pull/135) [`0aafac8`](https://github.com/forinda/clarusjs/commit/0aafac86777c10e645e401728b880f4ac6db74cf) Thanks [@forinda](https://github.com/forinda)! - Page sources: `clarusjs({ sources: [...] })` lets a plugin turn files with another extension (such as `.md` from `@clarusjs/content`) into `.tscl` text, compiled like any page: routes, layouts, components, styles, islands and the manifest all apply. Only files under `src/` are claimed, never `?raw`/`?url` imports.

- [#130](https://github.com/forinda/clarusjs/pull/130) [`a3992c0`](https://github.com/forinda/clarusjs/commit/a3992c0edb63add64b6f4227b14fd2de604ab31d) Thanks [@forinda](https://github.com/forinda)! - `<style>` in `.tscl` files. A top-level `<style>` is the component's stylesheet, scoped with native `@scope`: the component's top-level elements get `data-cl-c="<id>"`, rules apply inside them (style the top-level element itself with `:scope`) and stop at other components. `<style global>` is left unscoped. Every component's styles are bundled into one stylesheet (minified and hashed by Vite) that every page links; in dev it is regenerated when a `.tscl` file changes. `{{ }}` holes in a component `<style>` are a located build error: pass values as CSS custom properties.

### Patch Changes

- [#140](https://github.com/forinda/clarusjs/pull/140) [`67ab0b2`](https://github.com/forinda/clarusjs/commit/67ab0b2fe87e52153453433132990f7fdc653b97) Thanks [@forinda](https://github.com/forinda)! - The documentation lives at https://clarusjs.com: package homepages and READMEs point there.

- [#138](https://github.com/forinda/clarusjs/pull/138) [`6429743`](https://github.com/forinda/clarusjs/commit/64297432255bf4cbf614bda08318bdaf1ae44e5d) Thanks [@forinda](https://github.com/forinda)! - Page sources get `root` and `addDependency(file)` in their context (files they read are watched in dev), and only apply under `src/pages`: a source-extension file elsewhere (such as a Markdown part to include) is not a page or a component.

## 0.6.0

### Minor Changes

- [#106](https://github.com/forinda/clarusjs/pull/106) [`0d2a8bf`](https://github.com/forinda/clarusjs/commit/0d2a8bfbed364ada58ddac64e44f2703aff5d456) Thanks [@forinda](https://github.com/forinda)! - Fragment navigation: with `fragments: true`, every static and server page loads a navigation script (under 1 KB gzip) that intercepts same-site navigations with the Navigation API, fetches the page's `index.frag.html`, swaps its region (`data-cl-swap`, or the body), updates the title, and attaches the islands that arrive. Elements marked `data-cl-persist="key"` are kept across swaps with their state. Back and forward work; only the latest navigation may change the page; a failure falls back to a normal load. Browsers without the Navigation API load pages normally.

- [#105](https://github.com/forinda/clarusjs/pull/105) [`8edebd6`](https://github.com/forinda/clarusjs/commit/8edebd69d434ab899940ba345e15619dabdfe081) Thanks [@forinda](https://github.com/forinda)! - Fragment responses: with `fragments: true`, every static and server page also answers at `<path>/index.frag.html` with its `<title>` and its swap region (the element marked `data-cl-swap`, or the `<body>`). `vite build` writes the files next to each static page; server routes serve them from the handler and, with `adapter: 'netlify'`, from the function. The URL selects the fragment (not a header), so it works on static hosts.

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
