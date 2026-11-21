# clarusjs

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
