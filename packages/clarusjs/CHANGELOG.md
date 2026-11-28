# clarusjs

## 0.19.1

### Patch Changes

- [#662](https://github.com/forinda/clarusjs/pull/662) [`287127f`](https://github.com/forinda/clarusjs/commit/287127fc8d391d734fb379155a79d64e393fb2ce) Thanks [@forinda](https://github.com/forinda)! - A theme or other package installed by pnpm had its built stylesheet and island scripts written under `assets/node_modules/.pnpm/…`. GitHub Pages' upload skips folders starting with a dot, so on Pages the site came out unstyled. Files from a package are now named from the package (`assets/_pkg/@clarusjs/theme-docs/…`), and no built file lands in a folder starting with a dot.

## 0.19.0

### Minor Changes

- [#653](https://github.com/forinda/clarusjs/pull/653) [`45aed57`](https://github.com/forinda/clarusjs/commit/45aed578d7d0ba4222fc76071dc7d2635d8751f1) Thanks [@forinda](https://github.com/forinda)! - Vite's `base` now reaches every link. A site under a path (`base: '/docs/'`, a GitHub Pages project site) works with links written as if it were at the root:
  - **Templates and Markdown:** root-relative URL attributes get the base, whether written or bound, in pages, islands and client routes.
  - **Head tags:** the ones from the `head` option get it too.
  - **`h()` output:** so does every element `h()` builds.
  - **`navigate('/x')`:** so do paths passed to it.

  A URL already under the base is left as it is, so `href()` and hand-written base links keep working. New in `clarusjs/navigation`: `withBase()` and `withoutBase()`, for URLs built in code.

  The build warns about same-site links outside the base (`links.outside`), and about a route that starts with the base.

  A full-URL (CDN) base (`base: 'https://cdn.example.com/docs/'`) now moves only the assets, as in Vite: pages stay at the site's root everywhere, including the sitemap, the 404 and 500 pages' links, headers, redirects, the adapters and `serve()`, which used to put them under the CDN URL's path.

### Patch Changes

- [#654](https://github.com/forinda/clarusjs/pull/654) [`ce0714b`](https://github.com/forinda/clarusjs/commit/ce0714bb00875a455c532a1ab477d55ce8ea7e8c) Thanks [@forinda](https://github.com/forinda)! - When a client route swapped in, its page's JSON-LD or JSON `<script>` in the head ran as JavaScript and threw ("Unexpected token ':'"), and on those pages islands could fail to attach. Now only real scripts run (no type, `module`, or a JavaScript type), and a module script stays a module.

## 0.18.0

### Minor Changes

- [#647](https://github.com/forinda/clarusjs/pull/647) [`0306c9c`](https://github.com/forinda/clarusjs/commit/0306c9cabe7d8196d400600367d5506e478769be) Thanks [@forinda](https://github.com/forinda)! - `clarusjs/runtime` exports `attrValue()` and `UNSAFE_URL`: the attribute and URL check templates use, for code that writes attributes itself.

### Patch Changes

- [#647](https://github.com/forinda/clarusjs/pull/647) [`0306c9c`](https://github.com/forinda/clarusjs/commit/0306c9cabe7d8196d400600367d5506e478769be) Thanks [@forinda](https://github.com/forinda)! - Two fixes for form fields:

  - A textarea's `[value]` or `[(value)]` now renders as its text in the HTML. It used to render as a `value` attribute, which browsers ignore, so the textarea showed empty until JavaScript ran.
  - Text typed into a field before its island attaches (with `attach="interaction"`, `"idle"` or `"visible"`) is no longer reset at attach. The replayed input writes it to state.

## 0.17.0

### Minor Changes

- [#632](https://github.com/forinda/clarusjs/pull/632) [`93f2164`](https://github.com/forinda/clarusjs/commit/93f216461cabcd6159e5b99f1f9d39ffe8cdf4bf) Thanks [@forinda](https://github.com/forinda)! - `adapter: 'cloudflare'`: `vite build` writes a bundled worker (`dist/client/_worker.js/`) running the same handler for server routes and endpoints, `_routes.json` so static files are served first, and `.assetsignore` so the folder also deploys as a Worker with static assets. The worker applies `_headers` to its responses. `clarusjs serve` never serves these files.

- [#632](https://github.com/forinda/clarusjs/pull/632) [`62b573a`](https://github.com/forinda/clarusjs/commit/62b573a98491a76e39e069ea627c33dcf70e1235) Thanks [@forinda](https://github.com/forinda)! - Environment variables: in dev, build and preview, `.env` files' variables reach server code through `process.env` (never overriding the host's). New `env` plugin option names required variables (`{ server, browser }`): the build fails naming any that is missing, and `.clarusjs/env.d.ts` types them. New lint rule `server-env-in-browser` (an error by default): `process.env`, or an unprefixed `import.meta.env` variable, read in a browser script.

- [#576](https://github.com/forinda/clarusjs/pull/576) [`decfbbc`](https://github.com/forinda/clarusjs/commit/decfbbc4dfaaf2e24274b053a53db0e7a0e3a980) Thanks [@forinda](https://github.com/forinda)! - Event modifiers and `$values` ([#444](https://github.com/forinda/clarusjs/issues/444)): `(submit.prevent)="send($values)"` keeps a form in the page without `$event.preventDefault()`, and `$values` is the form's fields as an object (a repeated name gives a list; the submitter counts). Also `.stop`, `.self`, `.once`, keys (`(keydown.enter)`, `(keydown.esc)`, a letter) and `.ctrl`, `.shift`, `.alt`, `.meta`. A misspelled modifier, a key on an event without keys, or a modifier on a component's event is a located error; `clarusjs check` types `$event` by the event's name and `$values` as `Record<string, any>`.

- [#579](https://github.com/forinda/clarusjs/pull/579) [`9ca4eb4`](https://github.com/forinda/clarusjs/commit/9ca4eb4237ad3761f89b3b916fc45e527a6eed1c) Thanks [@forinda](https://github.com/forinda)! - `clarusjs explain <route>` lists the route's layouts (config and folder, outermost first) and its folders' `+guard.ts` (outer first), and the route manifest has them as `layouts` and `guards` ([#472](https://github.com/forinda/clarusjs/issues/472)).

- [#588](https://github.com/forinda/clarusjs/pull/588) [`04f97c4`](https://github.com/forinda/clarusjs/commit/04f97c46320ad87fbce84fb3ab1dc4d60673500c) Thanks [@forinda](https://github.com/forinda)! - `@for (section of sections; track section.id; let s = $index)`: name a row's `$index` (or `$count`, `$first`, `$last`, `$even`, `$odd`) so a nested loop can use the outer row's: `{{ s + 1 }}.{{ $index + 1 }}`, `[(value)]="order.sections[s].items[$index].name"`. Indexing an outer loop's list with the inner `$index` (which reads or writes the wrong row) is now a compile error, also in `clarusjs check`, that points to `let`.

- [#586](https://github.com/forinda/clarusjs/pull/586) [`48f18f5`](https://github.com/forinda/clarusjs/commit/48f18f52bd53abbe15152907defdd9f05f6a0b6b) Thanks [@forinda](https://github.com/forinda)! - Forms: `f.dirty` says whether anything differs from the starting values (compared by value: a field typed into and back is clean again), and `f.shown(path)` whether a field's error shows now by the form's `show` rule, for a component or custom control that shows its own error.

- [#582](https://github.com/forinda/clarusjs/pull/582) [`55535a1`](https://github.com/forinda/clarusjs/commit/55535a176c3527c05edf933f39ca6c27aa352ce5) Thanks [@forinda](https://github.com/forinda)! - An island page (a page with a `<script>` or a `@model` input) gets its folder and config layouts ([#472](https://github.com/forinda/clarusjs/issues/472)): they render around the island as server HTML, and the browser loads only the page's own code. Such a page can't fill its layouts' named slots (a located error), and in a client route it still needs `@layout none`.

- [#615](https://github.com/forinda/clarusjs/pull/615) [`80d54da`](https://github.com/forinda/clarusjs/commit/80d54da684eea571c110e103da712b0813b0b38f) Thanks [@forinda](https://github.com/forinda)! - An @imported component answers to its name in kebab case: `@import uiButton` or `@import UiButton` is `<ui-button>` too (before, `<ui-button>` silently rendered as a plain element). Only hyphenated forms: a one-word import such as `Button` never takes `<button>`. The language server's hover, go to definition, references and rename follow, keeping each tag in the case it was written.

- [#581](https://github.com/forinda/clarusjs/pull/581) [`a2dea43`](https://github.com/forinda/clarusjs/commit/a2dea433d8914414eb65cd6695dfd3957f2b8d2f) Thanks [@forinda](https://github.com/forinda)! - `+layout.load.ts`: a folder layout's own data ([#472](https://github.com/forinda/clarusjs/issues/472)). Its `load({ params })` returns the layout's inputs for every page it wraps, like a component's `.load.ts`. Folder and config layouts' stylesheets, components and loaders are now the page's too: a `+layout.tscl` that imports a `.css` file gets it linked on its pages.

- [#571](https://github.com/forinda/clarusjs/pull/571) [`a0cba93`](https://github.com/forinda/clarusjs/commit/a0cba938f2caef14291987270cc996f95fe3c5ef) Thanks [@forinda](https://github.com/forinda)! - Lint rule `for-shadow`: an `@for` row named like something the component declares (a script or server-script name, an `@input` or `@model`, an import) hides it inside the loop, so `[class]="item"` there reads the row. A warning, at the row's name.

- [#627](https://github.com/forinda/clarusjs/pull/627) [`00ab0f9`](https://github.com/forinda/clarusjs/commit/00ab0f9f5df86d5090255e6f9e76708e13e4eb3f) Thanks [@forinda](https://github.com/forinda)! - Lint rule `multi-word-name` (a warning): a component imported under a one-word name (`card`) is reported. Two words or more (`userCard`) give it a kebab-case tag (`<user-card>`) and can't be mistaken for an HTML element.

- [#618](https://github.com/forinda/clarusjs/pull/618) [`e98bb07`](https://github.com/forinda/clarusjs/commit/e98bb0746bac181d706048e449395748814d1f08) Thanks [@forinda](https://github.com/forinda)! - clarusjs/navigation: `searchParams` (the current query, as a store), `setSearch(changes, { replace, state, scroll })` (set, repeat or remove query params and go there; replaces the entry and keeps the scroll position by default), `navigationState()` (what `navigate(url, { state })` stored), and `scroll: false` on `navigate()` to keep the visitor where they are. The Navigation guide is rewritten by task: where am I, moving, query strings, scroll, history state, cancelling, loading states.

- [#632](https://github.com/forinda/clarusjs/pull/632) [`ba729cf`](https://github.com/forinda/clarusjs/commit/ba729cf241a6e3dcc61240792d1a94a2cef5563a) Thanks [@forinda](https://github.com/forinda)! - `clarusjs serve` (and `serve()` / `createListener()` from `clarusjs/node`) runs a built site on any Node host: files with ETags, immutable caching for hashed assets, server routes and endpoints through the built handler, the 404 page, and precompressed copies. New `headers` plugin option: response headers by path pattern, written to `_headers` (read by Netlify and Cloudflare Pages, applied by `clarusjs serve` and `vite preview`), after safe defaults (`nosniff`, `Referrer-Policy`, immutable assets). `headers: false` writes none.

- [#632](https://github.com/forinda/clarusjs/pull/632) [`9427082`](https://github.com/forinda/clarusjs/commit/9427082ba607c67a6bf1992f0ae6a495a9cc1293) Thanks [@forinda](https://github.com/forinda)! - `clarusjs/seo`: typed builders for schema.org structured data (`article`, `breadcrumbs`, `product`, `organization`, `website`), for a page's JSON-LD script or `head.jsonLd`. Names become people, dates ISO strings, availability schema.org URLs; a relative URL is an error naming the field.

- [#642](https://github.com/forinda/clarusjs/pull/642) [`2cc2834`](https://github.com/forinda/clarusjs/commit/2cc2834ea722706bd7dab19648b2cf17315b6101) Thanks [@forinda](https://github.com/forinda)! - `@transition` around a `@for`: rows added enter and rows removed leave with the transition's classes (the leaving rows keep their place until their animations end), and rows that move slide into place with a `<name>-move` class (FLIP, translate only; skipped under reduced motion). `appear`, `duration`, `css: false` and the hooks work per row. `clarusjs check`, the lint, Prettier and the ESLint plugin read the wrapper around a `@for` too.

- [#641](https://github.com/forinda/clarusjs/pull/641) [`3b7a4ba`](https://github.com/forinda/clarusjs/commit/3b7a4ba9f0a27745c240853e4868de27a84b7910) Thanks [@forinda](https://github.com/forinda)! - `@transition (name, options) { @if … }` animates an island's `@if` branches in and out with Vue's classes (`fade-enter-from`, `fade-leave-to`…; `cl-` without a name): the leaving branch stays, inert and unwired, until its animations end (or 5 s). Options: `mode` (`'out-in'`, `'in-out'`), `appear`, `duration`, `css: false` and Vue's hooks. The code is a new `clarusjs/motion` module (1.8 KB gzip) that only islands using `@transition` load; `clarusjs check` types its arguments. The AI guidance describes it.

- [#632](https://github.com/forinda/clarusjs/pull/632) [`663e08e`](https://github.com/forinda/clarusjs/commit/663e08e0c7949edf33d8fe63ddca2b4f9f96d224) Thanks [@forinda](https://github.com/forinda)! - `adapter: 'vercel'`: `vite build` writes Vercel's Build Output API (`.vercel/output`): static files with clean URLs, one bundled Node function running the same handler for server routes and endpoints, and routes for `_headers`, `_redirects` and the 404 page.

### Patch Changes

- [#589](https://github.com/forinda/clarusjs/pull/589) [`c3abe21`](https://github.com/forinda/clarusjs/commit/c3abe21592a69d8b4f90b7e2a58748ddcfdce92e) Thanks [@forinda](https://github.com/forinda)! - Islands with long lists attach quickly. Wiring a `@for` row looks only between that row's markers (it searched the whole island once per row), and finding which island an element belongs to counts the slot markers before it once per list while an island attaches (it walked back over every earlier row, for each one). In Chromium, a 4,000-row list attached in 2.8 s and now in 65 ms; a form with about 2,000 fields over 80 sections went from 550 to 136 ms.

- [#626](https://github.com/forinda/clarusjs/pull/626) [`f2db9c6`](https://github.com/forinda/clarusjs/commit/f2db9c68cd7956271f6f18135f0e3ec375e007d3) Thanks [@forinda](https://github.com/forinda)! - `clarusjs check` reports a `<script server>` in a component an island renders (the build rejects it: islands re-render their children in the browser), and still accepts it under static pages.

- [#626](https://github.com/forinda/clarusjs/pull/626) [`aa19e04`](https://github.com/forinda/clarusjs/commit/aa19e042e3c1bfb8cfe34d01c004063e6ff57a72) Thanks [@forinda](https://github.com/forinda)! - `clarusjs check` also runs the compiler's own rules, so it reports what `vite build` would reject (a `<slot />` inside component content in an island, TypeScript in a template expression, and the like) at `file.tscl:line:col`. Where TypeScript already reports an error on that line, it isn't repeated.

- [#580](https://github.com/forinda/clarusjs/pull/580) [`0f91b43`](https://github.com/forinda/clarusjs/commit/0f91b43d517f62135caeafeef6432f5e4e4e62c3) Thanks [@forinda](https://github.com/forinda)! - In dev, adding or removing a `+layout.tscl` reaches the pages under its folder right away, without restarting the server ([#472](https://github.com/forinda/clarusjs/issues/472)).

- [#618](https://github.com/forinda/clarusjs/pull/618) [`02eba01`](https://github.com/forinda/clarusjs/commit/02eba0181449136fee97076bc4cb7b7392c871b0) Thanks [@forinda](https://github.com/forinda)! - An island's `@for` whose list in the browser differs from the one the server rendered (it reads the URL, storage, or anything else the server can't see) now attaches and shows the browser's list. Before, attaching adopted the server's rows by position and failed when there were more of them.

- [#585](https://github.com/forinda/clarusjs/pull/585) [`12d6637`](https://github.com/forinda/clarusjs/commit/12d663758e4dca719013135dac4c4365056670d1) Thanks [@forinda](https://github.com/forinda)! - Forms: an engine over many fields stays quick, and nested sections keep the right marks. Each change re-checks the fields once (it re-read every field's path for every field before, so a keystroke in a form with a thousand fields took seconds), and after rows or sections are added or removed, each field's error mark follows its own value.

- [#596](https://github.com/forinda/clarusjs/pull/596) [`f391a74`](https://github.com/forinda/clarusjs/commit/f391a74d3e53ffb2140ee7b7e9cd432eaef756b5) Thanks [@forinda](https://github.com/forinda)! - forms: a keystroke rechecks the form once, not twice. The input listener queues the same refresh the value write does, so a field's mark and `f.error()` follow on the next microtask.

- [#598](https://github.com/forinda/clarusjs/pull/598) [`28e6064`](https://github.com/forinda/clarusjs/commit/28e6064ab0f1db86a2ddd8127b59c898002da8d3) Thanks [@forinda](https://github.com/forinda)! - A fill that receives a slot's data (`@slot('row', { item }) { … }`) can be inside an island when it shows the data: the island renders the component again, fill included, when what they read changes. Handlers and bindings in such a fill are still an error, now at their place.

- [#594](https://github.com/forinda/clarusjs/pull/594) [`f6249a4`](https://github.com/forinda/clarusjs/commit/f6249a4e581f604bc0e2c0baf7679d2cf5b138ef) Thanks [@forinda](https://github.com/forinda)! - A `<script>` is JavaScript, and TypeScript-only syntax in it is now an error at its place, named, in the build and in `clarusjs check` alike: `TypeScript syntax in a <script> (scripts are JavaScript): a type argument, request<string>(…)`. A type argument used to pass `check` and then run as two comparisons (`request < string > (…)`); annotations, `as`, `satisfies`, `!` and type declarations got acorn's "Unexpected token".

- [#617](https://github.com/forinda/clarusjs/pull/617) [`99ee086`](https://github.com/forinda/clarusjs/commit/99ee08662fd768164872cd4f6dcd385176aebd31) Thanks [@forinda](https://github.com/forinda)! - Back (or another page change) during a page change's view transition no longer reports an unhandled "Transition was skipped" rejection.

- [#570](https://github.com/forinda/clarusjs/pull/570) [`ac60077`](https://github.com/forinda/clarusjs/commit/ac6007743691f438a7591bb715e1f4df971f94c6) Thanks [@forinda](https://github.com/forinda)! - Content an island puts in a script-less component's slot is wired in place ([#523](https://github.com/forinda/clarusjs/issues/523)): state it reads no longer renders the whole component again, so a field being typed in there keeps its focus and caret, and an open picker stays open. Only the component's own props changing render it again.

- [#642](https://github.com/forinda/clarusjs/pull/642) [`53a768b`](https://github.com/forinda/clarusjs/commit/53a768bb5c2ce89fb056b0dcc5ca02e28cdd22af) Thanks [@forinda](https://github.com/forinda)! - - `clarusjs check`: client routes render in the browser, so a `<script server>` in their pages, or in what those use, is an error (as the build reports it).
  - A Markdown page with no layout gets its title (with the site's title template) and description in its head; a `<cl-head>` `<title data-cl-template>` gets the template.
  - Lint: a name spread into an array or object (`...name`) counts as read.
  - `@transition`: in `in-out` mode the old branch's text goes and its enter stops at the change; finished transitions leave no timer behind; the loader cleans up once per change; a leaving copy no longer blocks a hot-reload swap; an island waiting to attach never attaches once it's leaving.

- [#597](https://github.com/forinda/clarusjs/pull/597) [`402c57d`](https://github.com/forinda/clarusjs/commit/402c57dae6839854e7362dabaa871473c5498cb9) Thanks [@forinda](https://github.com/forinda)! - check: the names a `@slot` fill receives are typed by what the child's `<slot [x]>` passes, not `any`. A misspelled property, or a name the slot doesn't pass, is an error; a name with a default may be one it doesn't pass.

- [#569](https://github.com/forinda/clarusjs/pull/569) [`837e169`](https://github.com/forinda/clarusjs/commit/837e1698a2775779ce6e7a98e60c8f06fd6a374d) Thanks [@forinda](https://github.com/forinda)! - `[use]` behaviours run once the island, branch or row around them is wired, so one can set state while an island attaches (a saved choice, the URL): a `@for` after it no longer fails to attach on a changed list ([#550](https://github.com/forinda/clarusjs/issues/550)), and nested islands show the new value, also those whose script is still loading ([#524](https://github.com/forinda/clarusjs/issues/524)).

## 0.16.0

### Minor Changes

- [#508](https://github.com/forinda/clarusjs/pull/508) [`e32325f`](https://github.com/forinda/clarusjs/commit/e32325fcc70f6fad75e184e60abc7aa2ad105b16) Thanks [@forinda](https://github.com/forinda)! - `(name)` on a component that doesn't declare `@event name` is the DOM event on what it renders, as in Vue: `<likeButton (click)="likes++">` hears the click on its `<button>`, with the DOM event as `$event`. A declared `@event` still wins (the DOM event of the same name doesn't also fire). `clarusjs check` types `$event` as the DOM event and still reports a name that is neither an `@event` nor a DOM event.

- [#513](https://github.com/forinda/clarusjs/pull/513) [`2cb2c58`](https://github.com/forinda/clarusjs/commit/2cb2c5812318916cd72a5da13668f684418f83fa) Thanks [@forinda](https://github.com/forinda)! - Components from libraries. List installed component libraries, `clarusjs({ components: { libraries: ['@clarusjs/ui-primitives'] } })` (or `{ from, prefix }` for your own prefix), and their components work by name without `@import`: `<ui-tabs>`, `<ui-tab-list>`. A library describes itself in its package.json, `"clarusjs": { "components": "./src", "prefix": "ui" }`, and each component is imported as `<package>/<file>`. An `@import` wins, then your own components, then libraries; a name two libraries share is an error naming both. The dev server, builds and `clarusjs check` write the names and the configured `components.dirs` to `.clarusjs/components.json`, which the language server and the TypeScript content mapper read. `@clarusjs/ui-primitives` describes itself with the `ui` prefix.

- [#512](https://github.com/forinda/clarusjs/pull/512) [`3b770b3`](https://github.com/forinda/clarusjs/commit/3b770b3a142b5067ab8aa04d028aff6e750ce894) Thanks [@forinda](https://github.com/forinda)! - Lint fixes. A finding may carry a `fix` (`{ start, end, text }`); `one-root`'s wraps the component's top level in `<fragment>`, which renders the same HTML (a root `<fragment>` now renders like its children written at the top level: whitespace-only text between them is dropped, and so is the line break right after `<fragment>`). A `<script>`, `<style>` or declaration (`@input`, any `@import`, `@event`…) between the roots moves above them first, in order: wrapped, it would no longer be the component's, and at the top level its place doesn't matter. `clarusjs check --fix` writes fixes to the `.tscl` files before checking (with `--json`, the files it rewrote are listed on stderr), `applyFixes(source, messages)` from `clarusjs/compiler` applies them in code, ESLint's `--fix` applies them through `clarusjs/template`, and the language server offers each as a quick fix. A project's own rules can pass a fix as `report(start, message, fix)`.

- [#510](https://github.com/forinda/clarusjs/pull/510) [`2181938`](https://github.com/forinda/clarusjs/commit/21819387c6ea835e43e9c97258228c0aa92c773a) Thanks [@forinda](https://github.com/forinda)! - One root per component, `<fragment>`, and `@extends`.

  - `<fragment>` groups elements without rendering one, anywhere in a template (a component's root, an `@if` branch, a `@for` row, slot content). It takes no attributes, and a component whose root is one takes none from its parent: `clarusjs check` reports any `class`, attribute or `(event)` written on its tag.
  - The `one-root` lint rule warns about a component without one root element (files under a `pages` or `layouts` folder, and whole documents, are exempt; a layout kept elsewhere is warned about), so what a parent passes always has one place to land. It becomes an error in a later minor.
  - `@extends button` (or `input`, `textarea`, `select`, `option`, `a`, `img`, `form`, `label`, `details`, `dialog`): the component takes every attribute of that element, typed by `clarusjs check`, onto its root, which must be that element.
  - A stateful `@extends` island kept in place when its parent re-renders takes the new passed attributes (a parent's `[disabled]` changing reaches its root).
  - theme-docs: the page head and the contents part render a `<fragment>` (same HTML). The agent guidance teaches one root.

### Patch Changes

- [#537](https://github.com/forinda/clarusjs/pull/537) [`0086d3b`](https://github.com/forinda/clarusjs/commit/0086d3bdfa34c966d143f4f008226f8547ad6023) Thanks [@forinda](https://github.com/forinda)! - Image attributes (`src`, `srcset`, `poster`) accept object URLs (`blob:`), so a bound `<img [src]>` can preview a picked file. `href` still refuses them, and attributes that load a page or a script stay static only.

- [#493](https://github.com/forinda/clarusjs/pull/493) [`98d3f38`](https://github.com/forinda/clarusjs/commit/98d3f38b2e1e098b1b98ba8ae6681610a599a1b3) Thanks [@forinda](https://github.com/forinda)! - Attributes passed to a component also land on its root when the top level is one `@if` … `@else` with a single element in each branch (outside islands): the branch that renders gets them. A button that renders an `<a>` when given `href` keeps `aria-*`, `data-*`, `id` and `style` either way.

- [#521](https://github.com/forinda/clarusjs/pull/521) [`6641e73`](https://github.com/forinda/clarusjs/commit/6641e7352eff45c97d419cc8c8a676669f95506c) Thanks [@forinda](https://github.com/forinda)! - `attach="visible"` attaches in real browsers: it watched `<cl-island>` itself, which is `display: contents` and so never intersects; it now watches what the island holds.

## 0.15.0

### Minor Changes

- [#474](https://github.com/forinda/clarusjs/pull/474) [`0a9f2fb`](https://github.com/forinda/clarusjs/commit/0a9f2fbf6de7360750556f1c2c028e55be08296b) Thanks [@forinda](https://github.com/forinda)! - Attributes on a component land on its root element ([#463](https://github.com/forinda/clarusjs/issues/463)). `<item-list id="steps" aria-label="Steps" data-test="x" [aria-controls]="panel" />` renders them on the component's single top-level element (or passes them on to a component there). Attribute-like names only (`id`, `role`, `tabindex`, `hidden`, `lang`, `dir`, `style`, `data-*`, `aria-*`) that the component doesn't declare as inputs; the root's own attribute wins, except `style` and ARIA id lists (`aria-describedby`, `aria-labelledby`, `aria-controls`, `aria-owns`), which merge. Server HTML only: no JavaScript ships. `clarusjs check` accepts these names on a component tag and still reports others. Also: `name="text {{ expr }}"` on a component tag passes the text as a prop.

- [#470](https://github.com/forinda/clarusjs/pull/470) [`7e8c056`](https://github.com/forinda/clarusjs/commit/7e8c05654d6474e125b71b29ce4a6a19b9eb0f2a) Thanks [@forinda](https://github.com/forinda)! - Automatic component imports ([#458](https://github.com/forinda/clarusjs/issues/458)). Kebab-case components in `src/components/` and `src/layouts/` are used by name without `@import`: the full name is the folders and file joined (`forms/text-field.tscl` → `<forms-text-field>`), the short name the file alone (`<text-field>`) when no other component has it (two is a located error). Only names with a hyphen, only the components a template uses, and an explicit `@import` still works. Other hyphenated tags stay HTML (web components). `clarusjs check`, the content mapper and the language server (completion, hover, go to definition) know the same names. `clarusjs({ components: { dirs, auto } })` changes the folders or turns it off; non-kebab files get a warning. `clarusjs/compiler` exports `componentIndex()`.

- [#474](https://github.com/forinda/clarusjs/pull/474) [`40078ff`](https://github.com/forinda/clarusjs/commit/40078ffcfbdde79f96171b551ef2781b8950b4c9) Thanks [@forinda](https://github.com/forinda)! - Context ([#465](https://github.com/forinda/clarusjs/issues/465)): a component's script calls `provide('key', value)`, and components rendered inside it, in its template or in content passed to it at any depth, read it with `@context key: Type` (with an optional default). It's passed with each render as the `cx` render option, so it works in async renders and in an island's browser re-renders. Content for a slot is now compiled as a function of the context where it's placed. `clarusjs check`, Prettier, the language server and the VS Code grammar know `@context`.

- [#474](https://github.com/forinda/clarusjs/pull/474) [`c0d028f`](https://github.com/forinda/clarusjs/commit/c0d028fc70e8c11c4d98ce9f6b32c6ff2699d755) Thanks [@forinda](https://github.com/forinda)! - Component events ([#442](https://github.com/forinda/clarusjs/issues/442)). A component declares what it sends its parent with `@event change: number` (`@event close` for none) and sends it from its script with `emit('change', value, { reason, event })`. The parent island handles it on the tag, `<stepper (change)="total = $event" />`: `$event` is the value, `$info` has `reason`, `event` and `cancel()`, and cancelling makes the child's `emit()` return false, so a parent can veto a change without taking the value over. Events stop at the parent. `clarusjs check` types both sides (the value `emit()` gets, `$event` in the handler, and a misspelled event name). No HTML contract change: a `cl:event` DOM event travels like `@model` writes.

- [#469](https://github.com/forinda/clarusjs/pull/469) [`59426c5`](https://github.com/forinda/clarusjs/commit/59426c556d136bcc524a51b3dcd296f7f82bca23) Thanks [@forinda](https://github.com/forinda)! - Folder guards ([#457](https://github.com/forinda/clarusjs/issues/457)). A `+guard.ts` in a folder of `src/pages` exports `guard(context)`, which runs before every page and endpoint under it (and before their `load()`), outer folders first. Returning a `Response` (such as `redirect()`) answers instead; returning nothing goes on, and it may set `locals`. It gets `load()`'s context plus `url` (typed `GuardContext` from `clarusjs/server`), with the same rules: on a static route it runs at build and can't read cookies; for a client route it runs when the route's data is asked for. `+guard.ts` is never an endpoint.

- [#468](https://github.com/forinda/clarusjs/pull/468) [`e309175`](https://github.com/forinda/clarusjs/commit/e309175374892619d6d5a35f364ed93838851043) Thanks [@forinda](https://github.com/forinda)! - Folder and config layouts ([#456](https://github.com/forinda/clarusjs/issues/456)). A `+layout.tscl` in a folder of `src/pages` wraps every page in it and below it (deeper folders inside), and the plugin's `layouts` option wraps pages by route pattern (`{ layout, include, exclude }`, patterns as in `routes`; outermost, in order). The page's content fills the layout's default slot and its top-level `@slot('name') { }` fills the nearest layout's named slots; layouts get `path` and `params`, on the server and from the client router. `@layout none` opts a page out. `+` files under `src/pages` are never routes. Not yet: a page with a `<script>` of its own (a located error), `+layout.load.ts`, and Markdown pages.

- [#486](https://github.com/forinda/clarusjs/pull/486) [`e61e09c`](https://github.com/forinda/clarusjs/commit/e61e09c6e2cece2d8a051f095afd075e1788e042) Thanks [@forinda](https://github.com/forinda)! - Islands pass content to islands ([#465](https://github.com/forinda/clarusjs/issues/465)): content written inside an island can go to another island's `<slot />`, with its holes, handlers, blocks and `[use]`; each island wires only its own. An island's slot content now sits between `<!--[s-->` and `<!--]s-->` (a new marker in the HTML contract), and the runtime decides which island owns a node across those ranges. The "can't take content from inside another island yet" error is gone. Forms paths of fields in slot content come from the island that wrote them. Tabs' `[(value)]` and `(change)` work inside islands.

- [#474](https://github.com/forinda/clarusjs/pull/474) [`4324103`](https://github.com/forinda/clarusjs/commit/4324103b08cf161331e47c9b1e742fa918de5238) Thanks [@forinda](https://github.com/forinda)! - Islands take content at `<slot />` ([#465](https://github.com/forinda/clarusjs/issues/465)). The server renders it in the parent's scope and the browser never re-renders it, so in an island a slot sits outside `@if`, `@for` and `@await` blocks and component content, passes no data and has no fallback. Content from inside another island is a render error for now.

- [#461](https://github.com/forinda/clarusjs/pull/461) [`27a6a53`](https://github.com/forinda/clarusjs/commit/27a6a5333e6bdb371d5c7509eed4b8ea56d0f195) Thanks [@forinda](https://github.com/forinda)! - Scoped slots ([#455](https://github.com/forinda/clarusjs/issues/455)): a component passes data to the content filling a slot, `<slot name="row" [item]="item" [index]="$index">fallback</slot>`, and the fill names it like a function parameter, `@slot('row', { item, index }) { … }` (renames, defaults and `@slot('default', …)` work too). Rendered on the server; `clarusjs check` checks the values where they're passed (the names a fill receives are typed `any` for now). A fill that receives data inside an island is a located error, for now.

- [#474](https://github.com/forinda/clarusjs/pull/474) [`a8ea351`](https://github.com/forinda/clarusjs/commit/a8ea3512a4807e3398b01b4747fc027d29222976) Thanks [@forinda](https://github.com/forinda)! - `@clarusjs/ui-primitives` ([#464](https://github.com/forinda/clarusjs/issues/464)), a new package: accessible behaviours as small DOM functions, each `(element, options) → stop`: `rovingFocus` (one Tab stop, arrow keys by orientation and RTL, Home/End, disabled items skipped), `typeahead` (a repeated key cycles), `dismiss` (Escape and outside press, stacked layers, a cancelable `cl:dismiss` event), `enter` / `exit` (Base UI's `data-open`, `data-starting-style`, `data-ending-style` for CSS transitions), `focusReturn` and `position` (`data-side` and the `--anchor-width`, `--available-height`, `--transform-origin` variables). Each is its own module, no dependencies, about 2.3 KB gzip for all six.

  clarusjs: `[use]="fn"` on an element in an island calls `fn(element)` in the browser when the island attaches, and the function it returns when the element's branch, row or island goes (a list runs several). The server renders a `data-cl-u` marker only; `clarusjs check` types the element by its tag.

### Patch Changes

- [#485](https://github.com/forinda/clarusjs/pull/485) [`6d54f6f`](https://github.com/forinda/clarusjs/commit/6d54f6f1e610b5449a7caeb68ed50767dede92a7) Thanks [@forinda](https://github.com/forinda)! - Review fixes for context and island content ([#465](https://github.com/forinda/clarusjs/issues/465)): `provide` may only be called (a bare reference is a located error in the build and in `check`), an import may rename it (`import { provide as register }`) and any import binding the name `provide` is rejected, comments or not, `@context` names like `Object` work, a provided `__proto__` key reaches re-rendered content, an island's markers never include those of an island in its slot content, a `@model` field in a component inside another island's slot takes the right path, and an island whose content reads a nested provider that failed to load is retried with it instead of failing for good. Menu items name their menu (`data-menu`), so arrow keys and typeahead skip a nested menu's items; a radio group follows its value after a reset of the form it is in now (also after a fragment swap moved it); a focused tooltip trigger keeps its tooltip open when the pointer leaves.

- [#485](https://github.com/forinda/clarusjs/pull/485) [`b02ebc8`](https://github.com/forinda/clarusjs/commit/b02ebc83e348a81cd71e1e437902ec43bb71ad66) Thanks [@forinda](https://github.com/forinda)! - Context fixes ([#465](https://github.com/forinda/clarusjs/issues/465)): `@context` reads only what was provided (a name like `toString` no longer reads the object's own); a `provide` key must be a name `@context` can read; `clarusjs check` reports a script's own `provide` as the build does. The Tabs docs no longer suggest `[(value)]` and `(change)`, which need a parent island that can pass content to the tabs.

## 0.14.0

### Minor Changes

- [#438](https://github.com/forinda/clarusjs/pull/438) [`e78455e`](https://github.com/forinda/clarusjs/commit/e78455e2518ff3a9cfacb7b02aeb814764c00ef0) Thanks [@forinda](https://github.com/forinda)! - `@await (promise) { pending } @then (value) { … } @catch (error) { … }` ([#430](https://github.com/forinda/clarusjs/issues/430)). In an island the server renders the pending branch and the browser swaps in `@then` or `@catch` when the promise settles; when the expression's signals change a new promise starts, and only the newest one's answer shows. Outside islands the server awaits it and renders `@then` or `@catch` into the HTML (without `@catch`, a rejection fails the render). It reuses the `@if` block markers (`<!--[bN:0-->`). `clarusjs check` types `@then`'s name as the promise's value.

- [#435](https://github.com/forinda/clarusjs/pull/435) [`39e91e8`](https://github.com/forinda/clarusjs/commit/39e91e85b3c7a20be06f8575083f1e000ac22318) Thanks [@forinda](https://github.com/forinda)! - `clarusjs/fetch`: `action()`, for one-off async calls such as save, delete or like ([#429](https://github.com/forinda/clarusjs/issues/429)). It has `pending`, `error` and `result` for the template. `run(input)` never rejects (a failure lands in `error` and the callbacks); `runAsync(input)` does. A call while one runs joins it (no double submit), or with `concurrency: 'latest'` cancels it. It takes `abort()`, `timeout`, `onSuccess` / `onError` / `onSettled` (with the input), and `meta` for `configure()`'s handlers. Created in an island, a call in flight is cancelled when the island goes away.

  A resource's or action's `timeout` is reported as a `TimeoutError` even when the client rejects with its own error on abort (axios: `CanceledError`). The Fetching guide shows axios, ky or your own client with `resource()` and `action()`.

- [#434](https://github.com/forinda/clarusjs/pull/434) [`e22f57a`](https://github.com/forinda/clarusjs/commit/e22f57a12aa241c1d5f8033d35a437cc64d4e3e0) Thanks [@forinda](https://github.com/forinda)! - `clarusjs/fetch`: any response, cancelling, timeouts and error callbacks ([#431](https://github.com/forinda/clarusjs/issues/431)).

  - `request(url, options)` reads the body by its `Content-Type` (JSON for `application/json` and `+json`, text for `text/*` and XML, else a `Blob`; `undefined` for a 204), or as `as` says (`json`, `text`, `blob`, `arrayBuffer`, `formData`, `stream`, `response`); `parse` adds your own readers per content type. A plain object or array `body` is sent as JSON. A non-2xx response throws with `status` and `data` (the error body). `timeout` aborts with a `TimeoutError`. `as` sets the result's type (`text`: `string`, `response`: `Response`…). `json()` and the new `text()` are its shorthands; a `json()` error now has `data` too.
  - `resource()`: `abort()` cancels the run in flight (not an error), `timeout` fails a slow run (an error), and `onSuccess` / `onError` / `onSettled` run once per request, with `meta`.
  - `configure({ onSuccess, onError })`: handlers every resource calls after its own callbacks, for toasts in one place; a callback returning `false` skips them.

- [#437](https://github.com/forinda/clarusjs/pull/437) [`8215ea7`](https://github.com/forinda/clarusjs/commit/8215ea7cdbe851e8dbaf845601fbad5becdee2d0) Thanks [@forinda](https://github.com/forinda)! - `<script server>`: code that runs on the server while a page or component renders, and can `await` ([#430](https://github.com/forinda/clarusjs/issues/430)). Its names are there for the template, its imports never reach the browser (`node:` modules too), and it doesn't make the component an island. A component that awaits there renders asynchronously; its parents join what it returns, and stay synchronous when nothing they contain awaits. It isn't allowed in an island, inside one, or in a client route (located errors). The request handler, `render()` and `h()` from `clarusjs/views` await async renders, and component loaders' data now stays with its own render across `await`s (`AsyncLocalStorage`). An island's `<script>` still can't `await` at the top level; its error now names `<script server>` and `resource()`.

### Patch Changes

- [#445](https://github.com/forinda/clarusjs/pull/445) [`a0ee549`](https://github.com/forinda/clarusjs/commit/a0ee549af5a36b7b4ace50ab42627acd102d7259) Thanks [@forinda](https://github.com/forinda)! - In `vite dev`, every page loads Vite's client, islands or not. A page without islands loaded no JavaScript at all, so edits to its styles, its layout or a global stylesheet never reached the browser until a manual reload.

- [#441](https://github.com/forinda/clarusjs/pull/441) [`f194846`](https://github.com/forinda/clarusjs/commit/f1948466a96d486f3067171c51290bb0297be839) Thanks [@forinda](https://github.com/forinda)! - A `.tscl` file imported with `?raw`, `?url` or `?inline` (a code sample, a playground example) is left to Vite instead of being compiled as a component, which failed the build.

## 0.13.0

### Minor Changes

- [#408](https://github.com/forinda/clarusjs/pull/408) [`01f21e4`](https://github.com/forinda/clarusjs/commit/01f21e454db0bdf81d405c8ff580a6847e6b51b0) Thanks [@forinda](https://github.com/forinda)! - Class forms: `[class.active]="on"` toggles one class, and a bound `[class]` takes a string, an object (its truthy keys) or an array (falsy entries dropped, nested allowed), like clsx. All of an element's class sources merge, each class once, with the scope class, on the server and in islands; `clarusjs check` types them. `classValue()` is exported from the runtime. They used to compile to `class.active` and `[object Object]`.

- [#387](https://github.com/forinda/clarusjs/pull/387) [`77853de`](https://github.com/forinda/clarusjs/commit/77853decd380c972d094bdb871f90f4479029548) Thanks [@forinda](https://github.com/forinda)! - Built-in icons: `<icon name="lucide:rocket" />` renders an inline SVG at build time from any Iconify set the project installs (`pnpm add -D @iconify-json/lucide`), with no JavaScript. It's 1em high with its width in proportion, takes the text colour, and is `aria-hidden` unless labelled. The name must be static; a missing set or icon is an error at `file:line:col` with the closest names, in the build, `clarusjs check` and the editor. The editor completes sets and icon names and previews an icon on hover; the MCP `compile` tool resolves icons too. New `clarusjs/icons` (Node only) reads the sets; `CompileOptions.icon` passes them to the compiler.

- [#401](https://github.com/forinda/clarusjs/pull/401) [`e87ad85`](https://github.com/forinda/clarusjs/commit/e87ad8538c44ec5327097fb33cfd4702066fad30) Thanks [@forinda](https://github.com/forinda)! - The sitemap lists each page's translations: its head's `<link rel="alternate" hreflang="…" href="…">` tags become `<xhtml:link>` alternates with absolute URLs (and stay in the page).

- [#397](https://github.com/forinda/clarusjs/pull/397) [`b1d211f`](https://github.com/forinda/clarusjs/commit/b1d211f2192d3e379d834bf442ca932fcba16547) Thanks [@forinda](https://github.com/forinda)! - The sitemap lists each page's images with Google's image extension: every `<img>` resolved to an absolute URL, except decorative ones (`alt=""`) and `data:` URLs. `sitemap: { images: false }` leaves them out.

- [#398](https://github.com/forinda/clarusjs/pull/398) [`4d93a7b`](https://github.com/forinda/clarusjs/commit/4d93a7bfb58663d8f01f9c3b0c9767740827fb5d) Thanks [@forinda](https://github.com/forinda)! - `sitemap: { include }` adds URLs the build can't list (server and client routes): a list of paths, or a function returning one (async, to read them from a database at build time).

- [#400](https://github.com/forinda/clarusjs/pull/400) [`96d7ea1`](https://github.com/forinda/clarusjs/commit/96d7ea13dbe40ec8ee395374cb84d6beba68d396) Thanks [@forinda](https://github.com/forinda)! - Past 50,000 URLs, the build splits the sitemap into `sitemap-1.xml`, `sitemap-2.xml`… with `sitemap.xml` as their index, so its address doesn't change.

- [#396](https://github.com/forinda/clarusjs/pull/396) [`e8734bf`](https://github.com/forinda/clarusjs/commit/e8734bf2f3e2b512b45949522500ace2ccdc7bfb) Thanks [@forinda](https://github.com/forinda)! - A page sets its own sitemap date: `<cl-head><meta name="sitemap:lastmod" content="2026-11-01"></cl-head>` (or `lastmod:` in Markdown frontmatter) wins over the git date and is removed from the built page; a value that isn't a date fails the build, naming the page.

- [#412](https://github.com/forinda/clarusjs/pull/412) [`dff8f40`](https://github.com/forinda/clarusjs/commit/dff8f40dcd4f0b2cbf8cafd6dbe990462eb77212) Thanks [@forinda](https://github.com/forinda)! - Spread props onto a component with `[...]="props"`: every key is a prop, and props written on the tag win. `clarusjs check` types it against the child's inputs: the spread must provide the required inputs the tag doesn't write, with the right types.

- [#411](https://github.com/forinda/clarusjs/pull/411) [`c5dd711`](https://github.com/forinda/clarusjs/commit/c5dd711258cab06354c990cda5b7c87d728ca1c7) Thanks [@forinda](https://github.com/forinda)! - Spread attributes onto an element with `[...]="attrs"`. Attributes written on the element win (whatever the order or case), and `class` and `style` merge, the spread's first. Each value is escaped and URL-checked like `[attr]`. Event handlers, `srcdoc`, invalid names, JSX names (`className`, `htmlFor`) and object values are dropped, with a warning naming the place. A spread is refused on elements that load things (`iframe`, `frame`, `embed`, `object`, `base`, `link`, `meta`). In islands it follows state, removing keys that disappear. `{...x}` and dotted names other than `class.` / `style.` are now build errors instead of being written out. An empty `class` or `style` value removes the attribute rather than writing `class=""`.

- [#409](https://github.com/forinda/clarusjs/pull/409) [`6fd8398`](https://github.com/forinda/clarusjs/commit/6fd839848dbbeb34db573f2f8ae25c1d5f29757c) Thanks [@forinda](https://github.com/forinda)! - Style forms: `[style.color]="c"` (and custom properties, `[style.--accent]`, or camelCase, `[style.fontSize]`) sets one property, removed when the value is `null`, `undefined` or `false`; a bound `[style]` takes an object (camelCase keys to kebab-case, no units added). They merge with a written `style="…"`, on the server and in islands; `clarusjs check` types them. `styleValue()` is exported from the runtime. They used to compile to `style.color="…"` and `[object Object]`.

### Patch Changes

- [#422](https://github.com/forinda/clarusjs/pull/422) [`6cc6ec9`](https://github.com/forinda/clarusjs/commit/6cc6ec95031e6f963ceba74af85f5cb90aad6ba2) Thanks [@forinda](https://github.com/forinda)! - `vite preview` serves the precompressed copies that `compress` writes: the `.br` copy, else the `.gz` one, that the browser's `Accept-Encoding` accepts (not `q=0`), with `Content-Encoding`, the original's type and `Vary: Accept-Encoding`. A byte range, or a browser that accepts neither, gets the original. What preview sends now matches nginx `gzip_static` / Caddy `precompressed` with the same build.

- [#416](https://github.com/forinda/clarusjs/pull/416) [`e5650c7`](https://github.com/forinda/clarusjs/commit/e5650c787206ce8a13cf26613f02a47659c94c19) Thanks [@forinda](https://github.com/forinda)! - The README says how to pronounce clarusjs: KLAIR-us, from the Latin _clarus_, "clear, bright".

- [#420](https://github.com/forinda/clarusjs/pull/420) [`3a302a4`](https://github.com/forinda/clarusjs/commit/3a302a419ef8b341866c661e9b04dad94f7b541f) Thanks [@forinda](https://github.com/forinda)! - A component's `<style scoped>` reaches the content it passes to another component, such as a page's content inside its layout (`<docs>…</docs>`): when the component has a `<style scoped>`, the top-level elements of slot content (default and `@slot('name')`) get its scope class, as its own top-level elements do (without one, no class is added). Child components' roots keep their own class only.

- [#414](https://github.com/forinda/clarusjs/pull/414) [`2bc1db9`](https://github.com/forinda/clarusjs/commit/2bc1db9f298d9e07e77d8a44d8dd32f3c90f4d85) Thanks [@forinda](https://github.com/forinda)! - `.clarusjs/views.d.ts` writes a type import from the built-in `~/` alias as a path from `.clarusjs/` (`../src/…`), so it resolves without a `paths` entry in tsconfig.

## 0.12.0

### Minor Changes

- [#358](https://github.com/forinda/clarusjs/pull/358) [`7daaabe`](https://github.com/forinda/clarusjs/commit/7daaabe2d7eac69e57fe2744b94bd2c36a7945cd) Thanks [@forinda](https://github.com/forinda)! - A compile warning when state is changed in place, in a script or an event handler: `items.push(x)`, `items.sort()`, `form.a = 1`, `form.b.c++`, `delete form.a`, a Map's or Set's `set`/`add`/`delete`/`clear`. Nothing notifies, so the page doesn't update; the warning says what to assign instead (`items = [...items, …]`, `form = { ...form, a: … }`). Two-way bindings (`[(value)]`) already write a copy and aren't flagged.

- [#363](https://github.com/forinda/clarusjs/pull/363) [`5d58103`](https://github.com/forinda/clarusjs/commit/5d5810381b0455a534d434a4a67b72e96bbc70b4) Thanks [@forinda](https://github.com/forinda)! - Other Vite plugins can name components for clarusjs to build: `api: { clarusComponents: (root) => [...files] }`. They are found like the components under `src/`, so their styles reach the stylesheet and their islands get client chunks, though no page imports them by path (a docs theme's replacement for one of its parts, for example).

### Patch Changes

- [#357](https://github.com/forinda/clarusjs/pull/357) [`dd107bb`](https://github.com/forinda/clarusjs/commit/dd107bbdedc950fbcf9b120a9bb5569bf9f348cf) Thanks [@forinda](https://github.com/forinda)! - `clarusjs/forms`: a multi-step form moves between steps inside a sandboxed frame too (a `srcdoc` iframe, an embedded preview). There `history.pushState` throws, and `next()` rejected with the step half-changed; now the step moves, without the URL hash.

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
