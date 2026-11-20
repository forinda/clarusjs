# @clarusjs/content

## 0.1.0

### Minor Changes

- [#136](https://github.com/forinda/clarusjs/pull/136) [`d96cff9`](https://github.com/forinda/clarusjs/commit/d96cff9a751b69a9d8b6cb3ad4378292e13cbb92) Thanks [@forinda](https://github.com/forinda)! - Containers and alerts: `::: tip|info|warning|danger [title]` and `::: details [title]` (a native `<details>`), plus GitHub alerts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`). Plain HTML by default (`<div class="custom-block tip">`); with `container: { tag, from }` they render through your own component, a custom title filling its `title` slot. Titles can be localized with `titles`.

- [#137](https://github.com/forinda/clarusjs/pull/137) [`eba37ef`](https://github.com/forinda/clarusjs/commit/eba37ef38fbf0a949f65078d31024bf4964aa36c) Thanks [@forinda](https://github.com/forinda)! - Build-time code highlighting with Shiki: light and dark colours at once as CSS variables (`--shiki-light`/`--shiki-dark`), so switching theme costs only CSS and no highlighter ships to the browser; `tscl` blocks highlighted as templates. Notation `{1,3-5}`, `[!code ++/--]`, `[!code focus]`, `[!code highlight]`, `[!code error/warning]`; `:line-numbers`; a `[title]`. `::: code-group` builds radio tabs that work without JavaScript. With `copy: { tag, from }`, every block gets your copy component.

- [#135](https://github.com/forinda/clarusjs/pull/135) [`0aafac8`](https://github.com/forinda/clarusjs/commit/0aafac86777c10e645e401728b880f4ac6db74cf) Thanks [@forinda](https://github.com/forinda)! - First release: Markdown pages for clarusjs. `.md` files under `src/pages` become pages (frontmatter `title`, `description`, `layout`), rendered to static HTML inside the layout at build time, with components usable in Markdown (`@import` lines at the top) and heading ids with anchor links. Template syntax in the Markdown stays text.

- [#139](https://github.com/forinda/clarusjs/pull/139) [`ea27476`](https://github.com/forinda/clarusjs/commit/ea274768707c611d1c321ca6e70e3fd1c776deb7) Thanks [@forinda](https://github.com/forinda)! - Link by file: relative Markdown links to page sources (`[Setup](./getting-started.md#install)`) become the target page's route, anchors and queries kept.

- [#138](https://github.com/forinda/clarusjs/pull/138) [`6429743`](https://github.com/forinda/clarusjs/commit/64297432255bf4cbf614bda08318bdaf1ae44e5d) Thanks [@forinda](https://github.com/forinda)! - Snippets and includes: `<<< @/src/x.ts#region{2} [title]` shows a file (or a `#region` of it, dedented) as a highlighted block, and `<!-- @include: ./part.md#region -->` includes Markdown, nested, with relative links rebased to the including page. `@` is the project root; both are left alone inside code fences. Files are watched in dev. Missing files or regions, include cycles and paths outside the project fail the build, naming the page.

### Patch Changes

- [#141](https://github.com/forinda/clarusjs/pull/141) [`5d15210`](https://github.com/forinda/clarusjs/commit/5d15210f2814ce368eaac0c78aabbd3ce64f482a) Thanks [@forinda](https://github.com/forinda)! - The page title (`h1`) keeps its id but gets no `#` anchor link: it would only repeat the heading for screen readers and show up in its text.

- [#140](https://github.com/forinda/clarusjs/pull/140) [`67ab0b2`](https://github.com/forinda/clarusjs/commit/67ab0b2fe87e52153453433132990f7fdc653b97) Thanks [@forinda](https://github.com/forinda)! - The documentation lives at https://clarusjs.com: package homepages and READMEs point there.
- Updated dependencies [[`85095f8`](https://github.com/forinda/clarusjs/commit/85095f8a693527363d079b18c70eeb6cadf91110), [`67ab0b2`](https://github.com/forinda/clarusjs/commit/67ab0b2fe87e52153453433132990f7fdc653b97), [`d049888`](https://github.com/forinda/clarusjs/commit/d0498884f0bdb226fd1643ef6ceb8bfbdba36ba6), [`ea27476`](https://github.com/forinda/clarusjs/commit/ea274768707c611d1c321ca6e70e3fd1c776deb7), [`0aafac8`](https://github.com/forinda/clarusjs/commit/0aafac86777c10e645e401728b880f4ac6db74cf), [`6429743`](https://github.com/forinda/clarusjs/commit/64297432255bf4cbf614bda08318bdaf1ae44e5d), [`a3992c0`](https://github.com/forinda/clarusjs/commit/a3992c0edb63add64b6f4227b14fd2de604ab31d)]:
  - clarusjs@0.7.0
