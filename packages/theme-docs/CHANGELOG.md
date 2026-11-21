# @clarusjs/theme-docs

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
