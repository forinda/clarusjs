# @clarusjs/theme-docs

## 0.1.1

### Patch Changes

- [#190](https://github.com/forinda/clarusjs/pull/190) [`e3392ef`](https://github.com/forinda/clarusjs/commit/e3392ef39bee3c5de3d548029b37b1bdcf8e5cd9) Thanks [@forinda](https://github.com/forinda)! - A thin progress bar at the top while a page change runs (from `html[data-cl-navigating]`, CSS only).

- [#187](https://github.com/forinda/clarusjs/pull/187) [`9ffaf94`](https://github.com/forinda/clarusjs/commit/9ffaf942bc3ebcee32265a61ada1c2502118c7c5) Thanks [@forinda](https://github.com/forinda)! - Search opens the chosen result with `navigate()` from `clarusjs/navigation`.

- [#174](https://github.com/forinda/clarusjs/pull/174) [`ad4a5e6`](https://github.com/forinda/clarusjs/commit/ad4a5e6f4a5ab6e77f6e841ee9d3af7c256eb957) Thanks [@forinda](https://github.com/forinda)! - The sidebar stays in view while the page scrolls (it scrolled away with the content), and the header's content lines up with the page instead of the window's edges. The header is `--header-height` tall, so the sidebar and the table of contents sit right under it. New token: `--page-width` (1440px).

- [#207](https://github.com/forinda/clarusjs/pull/207) [`b2a4aba`](https://github.com/forinda/clarusjs/commit/b2a4aba280288fa978f60432db67a71763d45e13) Thanks [@forinda](https://github.com/forinda)! - `viewTransitions: true` in the theme config cross-fades page changes where the browser supports view transitions (no animation with reduced motion).
- Updated dependencies [[`d3bfcad`](https://github.com/forinda/clarusjs/commit/d3bfcad7719f50e55599f357d59196489b0e2018), [`6faf6b2`](https://github.com/forinda/clarusjs/commit/6faf6b20fe62ee764e27f483031b7c84308a73a4), [`4d478ed`](https://github.com/forinda/clarusjs/commit/4d478edd0bb5b45e59a5943c1d0ef080847252c9), [`74ab408`](https://github.com/forinda/clarusjs/commit/74ab408acca5be012886e1e3c3b375c9c403da6d), [`a293c0a`](https://github.com/forinda/clarusjs/commit/a293c0a5f0eab6971cb8d3336542c3d40115bd47), [`bc20690`](https://github.com/forinda/clarusjs/commit/bc206903ee8c01a8292788fd8443c47656f57742), [`c80ed74`](https://github.com/forinda/clarusjs/commit/c80ed74fdf7163b0be9d9e3b5e4d1b9af0f38df2), [`9ffaf94`](https://github.com/forinda/clarusjs/commit/9ffaf942bc3ebcee32265a61ada1c2502118c7c5), [`e3392ef`](https://github.com/forinda/clarusjs/commit/e3392ef39bee3c5de3d548029b37b1bdcf8e5cd9), [`83383ad`](https://github.com/forinda/clarusjs/commit/83383adb2c8e42a3f7e078f6cc83ddb4012061dd), [`005cd31`](https://github.com/forinda/clarusjs/commit/005cd3123bffa1281d868138c3687648cc8107eb), [`2b38609`](https://github.com/forinda/clarusjs/commit/2b386098bb8919ad6c9af3fa26e3f78fbb434dde), [`770e109`](https://github.com/forinda/clarusjs/commit/770e109ff0a8c278a43ba7a8958e2b7a4af2a18e), [`e5c8f93`](https://github.com/forinda/clarusjs/commit/e5c8f93503049adcf11428090d15d11bac2ad2c9), [`b2a4aba`](https://github.com/forinda/clarusjs/commit/b2a4aba280288fa978f60432db67a71763d45e13)]:
  - clarusjs@0.8.1

## 0.1.0

### Minor Changes

- [#168](https://github.com/forinda/clarusjs/pull/168) [`c37358e`](https://github.com/forinda/clarusjs/commit/c37358e587c632c56e1b51e5fc4c6fc79e69225c) Thanks [@forinda](https://github.com/forinda)! - Lessons: `lesson.tscl`, a layout with a focused header (leave, "Lesson n of N", step segments, a `header-end` slot), one step at a time with Back/Continue in a fixed action bar, code and results beside the text on wide screens, and a plain page without JavaScript. The page `<head>` is shared by both layouts.

- [#163](https://github.com/forinda/clarusjs/pull/163) [`750d65f`](https://github.com/forinda/clarusjs/commit/750d65f945a755bc2988ae8ceb659f559ac0097a) Thanks [@forinda](https://github.com/forinda)! - First release: the docs layout from clarusjs.com as a theme.
  
  - **Regions at every width:** a header (brand, section links, social icons, a ⋯ overflow menu, a theme toggle), a sidebar that is a native-popover drawer below 1024 px, the content, and "On this page" as a column from 1280 px or a collapsible box below.
  - **Customizing:** configured with a `config` prop, extended through slots, restyled with CSS custom properties.
  - **Built in:** light and dark modes without a flash, copy buttons and callouts.

- [#165](https://github.com/forinda/clarusjs/pull/165) [`350d421`](https://github.com/forinda/clarusjs/commit/350d421f6f07de6567ad785e737e287f6107b1ed) Thanks [@forinda](https://github.com/forinda)! - "Last updated" and edit links from a pattern: `themeDocs()` pages carry their source `file` and last commit time (`updated`, one `git log`), and with `config.pages` the layout shows the date and builds `editLink: '…/edit/main/src/pages/:file'`. Dynamic routes are listed (hidden from the sidebar) so their edit links resolve.

- [#171](https://github.com/forinda/clarusjs/pull/171) [`9bd9a5d`](https://github.com/forinda/clarusjs/commit/9bd9a5d074687ebade6841e6fe1e27cb186cd624) Thanks [@forinda](https://github.com/forinda)! - Learning progress in the browser: `config.learn` (the Learn section and its progress page). Lessons record steps, finished lessons and first quiz answers in one versioned `localStorage` key; XP and badges are computed from it. An XP chip shows in lesson headers and Learn pages, the Learn sidebar marks lessons done / up next / not started, and `learn-progress.tscl` shows XP, lessons, quiz accuracy, badges and Reset. Blocked storage and no JavaScript degrade to plain pages.

- [#170](https://github.com/forinda/clarusjs/pull/170) [`ead1b03`](https://github.com/forinda/clarusjs/commit/ead1b03ec5c7ed986c50cdc57da87215edd6fd39) Thanks [@forinda](https://github.com/forinda)! - Quizzes: `quiz.tscl` (question, an island for the options with Check and a polite announcement, the answer and explanation in a `<details>`). In a lesson the action bar's button becomes Check and turns green or red; right and wrong are also marked in words. Green and red tokens (`--ok`, `--bad`) are part of the theme.

- [#166](https://github.com/forinda/clarusjs/pull/166) [`d47a225`](https://github.com/forinda/clarusjs/commit/d47a225431ce541155d5794df1911832cae60898) Thanks [@forinda](https://github.com/forinda)! - Search: `themeDocs()` indexes the built pages by heading section into small files loaded on demand (words sharded by their first two letters, sections in chunks), and `config.search` adds a Ctrl/⌘K or `/` dialog (native modal: focus kept inside, Escape, arrow keys, Enter, result count announced). The plugin's types are now generated from its JSDoc.

- [#164](https://github.com/forinda/clarusjs/pull/164) [`4e2a773`](https://github.com/forinda/clarusjs/commit/4e2a773b2877e77b4f1036ca6f851047180b4adc) Thanks [@forinda](https://github.com/forinda)! - The sidebar from the pages: the `themeDocs()` Vite plugin (`@clarusjs/theme-docs/vite.js`) reads `src/pages` and serves each page's title, frontmatter `group` and `order` as `virtual:theme-docs/pages`; `pagesNav(sections, pages)` fills each section from its folder, with the config's own groups and items kept first.

### Patch Changes

- Updated dependencies [[`ed45e75`](https://github.com/forinda/clarusjs/commit/ed45e7503b0769cf6f15606e1764b205ec37c035), [`350d421`](https://github.com/forinda/clarusjs/commit/350d421f6f07de6567ad785e737e287f6107b1ed), [`c37358e`](https://github.com/forinda/clarusjs/commit/c37358e587c632c56e1b51e5fc4c6fc79e69225c), [`1697023`](https://github.com/forinda/clarusjs/commit/1697023ecd5015f40f4ea7ad6a68777d05afd16a), [`5c0509e`](https://github.com/forinda/clarusjs/commit/5c0509e91117e7f8931e46cd939cb6d4c64e1514), [`e55fc99`](https://github.com/forinda/clarusjs/commit/e55fc99a48e30153bcb33aad6747f39d19ab8ad6), [`45411d7`](https://github.com/forinda/clarusjs/commit/45411d706122449664cedd94cdfda9b6e0ed1ee9), [`02ff969`](https://github.com/forinda/clarusjs/commit/02ff969e791e771a307b3f57dd4043136edf4e16), [`f6d35df`](https://github.com/forinda/clarusjs/commit/f6d35dfe7184d261ffe6ad8f02eb4b1403862527), [`c0e086e`](https://github.com/forinda/clarusjs/commit/c0e086e4c4d7776e4d7d24f578661f2c9fe49318)]:
  - clarusjs@0.8.0
