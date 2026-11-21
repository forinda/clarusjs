# @clarusjs/content

## 0.2.1

### Patch Changes

- [#173](https://github.com/forinda/clarusjs/pull/173) [`4aa9db9`](https://github.com/forinda/clarusjs/commit/4aa9db93f0b9f369f8d13249aaf0b4933bec308c) Thanks [@forinda](https://github.com/forinda)! - A `verbatim` element in a Markdown page shows its text as written: `<code verbatim>{{ }}</code>` no longer shows `&[#123](https://github.com/forinda/clarusjs/issues/123);&[#123](https://github.com/forinda/clarusjs/issues/123); }}`.
- Updated dependencies [[`d3bfcad`](https://github.com/forinda/clarusjs/commit/d3bfcad7719f50e55599f357d59196489b0e2018), [`6faf6b2`](https://github.com/forinda/clarusjs/commit/6faf6b20fe62ee764e27f483031b7c84308a73a4), [`4d478ed`](https://github.com/forinda/clarusjs/commit/4d478edd0bb5b45e59a5943c1d0ef080847252c9), [`74ab408`](https://github.com/forinda/clarusjs/commit/74ab408acca5be012886e1e3c3b375c9c403da6d), [`a293c0a`](https://github.com/forinda/clarusjs/commit/a293c0a5f0eab6971cb8d3336542c3d40115bd47), [`bc20690`](https://github.com/forinda/clarusjs/commit/bc206903ee8c01a8292788fd8443c47656f57742), [`c80ed74`](https://github.com/forinda/clarusjs/commit/c80ed74fdf7163b0be9d9e3b5e4d1b9af0f38df2), [`9ffaf94`](https://github.com/forinda/clarusjs/commit/9ffaf942bc3ebcee32265a61ada1c2502118c7c5), [`e3392ef`](https://github.com/forinda/clarusjs/commit/e3392ef39bee3c5de3d548029b37b1bdcf8e5cd9), [`83383ad`](https://github.com/forinda/clarusjs/commit/83383adb2c8e42a3f7e078f6cc83ddb4012061dd), [`005cd31`](https://github.com/forinda/clarusjs/commit/005cd3123bffa1281d868138c3687648cc8107eb), [`2b38609`](https://github.com/forinda/clarusjs/commit/2b386098bb8919ad6c9af3fa26e3f78fbb434dde), [`770e109`](https://github.com/forinda/clarusjs/commit/770e109ff0a8c278a43ba7a8958e2b7a4af2a18e), [`e5c8f93`](https://github.com/forinda/clarusjs/commit/e5c8f93503049adcf11428090d15d11bac2ad2c9), [`b2a4aba`](https://github.com/forinda/clarusjs/commit/b2a4aba280288fa978f60432db67a71763d45e13)]:
  - clarusjs@0.8.1

## 0.2.0

### Minor Changes

- [#152](https://github.com/forinda/clarusjs/pull/152) [`3f7067a`](https://github.com/forinda/clarusjs/commit/3f7067a60066cfd4faa6f0f192b2744c3019bb1f) Thanks [@forinda](https://github.com/forinda)! - Highlighted code meets WCAG AA contrast. The default themes are GitHub's `github-light-default` and `github-dark-default`, whose colours were made for contrast. The light theme's comments use `#59636e` (5.9:1 on white) instead of `#6e7781` (4.55:1). Code block classes now name the new themes, so update any CSS that targets `shiki-themes github-light github-dark`.

- [#144](https://github.com/forinda/clarusjs/pull/144) [`1697023`](https://github.com/forinda/clarusjs/commit/1697023ecd5015f40f4ea7ad6a68777d05afd16a) Thanks [@forinda](https://github.com/forinda)! - Frontmatter `head` (`[[tag, attrs, content?]]`), `titleTemplate: false` (use the title as written) and `jsonLd` (structured data) go into the page's `<head>`.

- [#163](https://github.com/forinda/clarusjs/pull/163) [`750d65f`](https://github.com/forinda/clarusjs/commit/750d65f945a755bc2988ae8ceb659f559ac0097a) Thanks [@forinda](https://github.com/forinda)! - Markdown pages pass their `h2`/`h3` headings to the layout as `headings` (id, text, level), for an "On this page" list.

- [#147](https://github.com/forinda/clarusjs/pull/147) [`f6d35df`](https://github.com/forinda/clarusjs/commit/f6d35dfe7184d261ffe6ad8f02eb4b1403862527) Thanks [@forinda](https://github.com/forinda)! - Frontmatter `image` sets the page's social card image.

- [#170](https://github.com/forinda/clarusjs/pull/170) [`ead1b03`](https://github.com/forinda/clarusjs/commit/ead1b03ec5c7ed986c50cdc57da87215edd6fd39) Thanks [@forinda](https://github.com/forinda)! - `::: quiz Question` blocks: a task list of options (exactly one `- [x]`) and an explanation, as static HTML that works without JavaScript (radios, the answer in a `<details>`), or through a quiz component (`markdown({ quiz: { tag, from } })`). For lessons (`steps: true`) unless `quizzes: 'everywhere'`.

- [#148](https://github.com/forinda/clarusjs/pull/148) [`45411d7`](https://github.com/forinda/clarusjs/commit/45411d706122449664cedd94cdfda9b6e0ed1ee9) Thanks [@forinda](https://github.com/forinda)! - Frontmatter `sitemap: false` leaves a Markdown page out of the sitemap.

- [#168](https://github.com/forinda/clarusjs/pull/168) [`c37358e`](https://github.com/forinda/clarusjs/commit/c37358e587c632c56e1b51e5fc4c6fc79e69225c) Thanks [@forinda](https://github.com/forinda)! - Frontmatter `steps: true` wraps each `##` section of a page in `<section class="step" aria-labelledby="…">`, for lessons.

### Patch Changes

- [#168](https://github.com/forinda/clarusjs/pull/168) [`edb7df3`](https://github.com/forinda/clarusjs/commit/edb7df33b82259729e3c4cb28b8c8a75e4b64880) Thanks [@forinda](https://github.com/forinda)! - A page's headings (for "On this page" and lesson steps) are its top-level ones only: a `##` inside a blockquote or list no longer adds an entry.
- Updated dependencies [[`ed45e75`](https://github.com/forinda/clarusjs/commit/ed45e7503b0769cf6f15606e1764b205ec37c035), [`350d421`](https://github.com/forinda/clarusjs/commit/350d421f6f07de6567ad785e737e287f6107b1ed), [`c37358e`](https://github.com/forinda/clarusjs/commit/c37358e587c632c56e1b51e5fc4c6fc79e69225c), [`1697023`](https://github.com/forinda/clarusjs/commit/1697023ecd5015f40f4ea7ad6a68777d05afd16a), [`5c0509e`](https://github.com/forinda/clarusjs/commit/5c0509e91117e7f8931e46cd939cb6d4c64e1514), [`e55fc99`](https://github.com/forinda/clarusjs/commit/e55fc99a48e30153bcb33aad6747f39d19ab8ad6), [`45411d7`](https://github.com/forinda/clarusjs/commit/45411d706122449664cedd94cdfda9b6e0ed1ee9), [`02ff969`](https://github.com/forinda/clarusjs/commit/02ff969e791e771a307b3f57dd4043136edf4e16), [`f6d35df`](https://github.com/forinda/clarusjs/commit/f6d35dfe7184d261ffe6ad8f02eb4b1403862527), [`c0e086e`](https://github.com/forinda/clarusjs/commit/c0e086e4c4d7776e4d7d24f578661f2c9fe49318)]:
  - clarusjs@0.8.0

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
