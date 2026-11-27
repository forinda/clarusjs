# @clarusjs/content

## 0.6.1

### Patch Changes

- Updated dependencies [[`0306c9c`](https://github.com/forinda/clarusjs/commit/0306c9cabe7d8196d400600367d5506e478769be), [`0306c9c`](https://github.com/forinda/clarusjs/commit/0306c9cabe7d8196d400600367d5506e478769be)]:
  - clarusjs@0.18.0

## 0.6.0

### Minor Changes

- [#578](https://github.com/forinda/clarusjs/pull/578) [`f9c18b8`](https://github.com/forinda/clarusjs/commit/f9c18b87a58cffd11741d712d7842b324014c16d) Thanks [@forinda](https://github.com/forinda)! - Frontmatter `layout: false` renders a Markdown page with no layout at all, not even its folder and config layouts (it compiles as `@layout none`, [#472](https://github.com/forinda/clarusjs/issues/472)). A page with no layout of its own still gets them, as a `.tscl` page does.

### Patch Changes

- [#642](https://github.com/forinda/clarusjs/pull/642) [`53a768b`](https://github.com/forinda/clarusjs/commit/53a768bb5c2ce89fb056b0dcc5ca02e28cdd22af) Thanks [@forinda](https://github.com/forinda)! - - `clarusjs check`: client routes render in the browser, so a `<script server>` in their pages, or in what those use, is an error (as the build reports it).
  - A Markdown page with no layout gets its title (with the site's title template) and description in its head; a `<cl-head>` `<title data-cl-template>` gets the template.
  - Lint: a name spread into an array or object (`...name`) counts as read.
  - `@transition`: in `in-out` mode the old branch's text goes and its enter stops at the change; finished transitions leave no timer behind; the loader cleans up once per change; a leaving copy no longer blocks a hot-reload swap; an island waiting to attach never attaches once it's leaving.
- Updated dependencies [[`c3abe21`](https://github.com/forinda/clarusjs/commit/c3abe21592a69d8b4f90b7e2a58748ddcfdce92e), [`f2db9c6`](https://github.com/forinda/clarusjs/commit/f2db9c68cd7956271f6f18135f0e3ec375e007d3), [`aa19e04`](https://github.com/forinda/clarusjs/commit/aa19e042e3c1bfb8cfe34d01c004063e6ff57a72), [`93f2164`](https://github.com/forinda/clarusjs/commit/93f216461cabcd6159e5b99f1f9d39ffe8cdf4bf), [`0f91b43`](https://github.com/forinda/clarusjs/commit/0f91b43d517f62135caeafeef6432f5e4e4e62c3), [`62b573a`](https://github.com/forinda/clarusjs/commit/62b573a98491a76e39e069ea627c33dcf70e1235), [`decfbbc`](https://github.com/forinda/clarusjs/commit/decfbbc4dfaaf2e24274b053a53db0e7a0e3a980), [`9ca4eb4`](https://github.com/forinda/clarusjs/commit/9ca4eb4237ad3761f89b3b916fc45e527a6eed1c), [`02eba01`](https://github.com/forinda/clarusjs/commit/02eba0181449136fee97076bc4cb7b7392c871b0), [`04f97c4`](https://github.com/forinda/clarusjs/commit/04f97c46320ad87fbce84fb3ab1dc4d60673500c), [`48f18f5`](https://github.com/forinda/clarusjs/commit/48f18f52bd53abbe15152907defdd9f05f6a0b6b), [`12d6637`](https://github.com/forinda/clarusjs/commit/12d663758e4dca719013135dac4c4365056670d1), [`f391a74`](https://github.com/forinda/clarusjs/commit/f391a74d3e53ffb2140ee7b7e9cd432eaef756b5), [`55535a1`](https://github.com/forinda/clarusjs/commit/55535a176c3527c05edf933f39ca6c27aa352ce5), [`28e6064`](https://github.com/forinda/clarusjs/commit/28e6064ab0f1db86a2ddd8127b59c898002da8d3), [`80d54da`](https://github.com/forinda/clarusjs/commit/80d54da684eea571c110e103da712b0813b0b38f), [`a2dea43`](https://github.com/forinda/clarusjs/commit/a2dea433d8914414eb65cd6695dfd3957f2b8d2f), [`a0cba93`](https://github.com/forinda/clarusjs/commit/a0cba938f2caef14291987270cc996f95fe3c5ef), [`00ab0f9`](https://github.com/forinda/clarusjs/commit/00ab0f9f5df86d5090255e6f9e76708e13e4eb3f), [`e98bb07`](https://github.com/forinda/clarusjs/commit/e98bb0746bac181d706048e449395748814d1f08), [`ba729cf`](https://github.com/forinda/clarusjs/commit/ba729cf241a6e3dcc61240792d1a94a2cef5563a), [`f6249a4`](https://github.com/forinda/clarusjs/commit/f6249a4e581f604bc0e2c0baf7679d2cf5b138ef), [`9427082`](https://github.com/forinda/clarusjs/commit/9427082ba607c67a6bf1992f0ae6a495a9cc1293), [`99ee086`](https://github.com/forinda/clarusjs/commit/99ee08662fd768164872cd4f6dcd385176aebd31), [`ac60077`](https://github.com/forinda/clarusjs/commit/ac6007743691f438a7591bb715e1f4df971f94c6), [`53a768b`](https://github.com/forinda/clarusjs/commit/53a768bb5c2ce89fb056b0dcc5ca02e28cdd22af), [`2cc2834`](https://github.com/forinda/clarusjs/commit/2cc2834ea722706bd7dab19648b2cf17315b6101), [`3b7a4ba`](https://github.com/forinda/clarusjs/commit/3b7a4ba9f0a27745c240853e4868de27a84b7910), [`402c57d`](https://github.com/forinda/clarusjs/commit/402c57dae6839854e7362dabaa871473c5498cb9), [`837e169`](https://github.com/forinda/clarusjs/commit/837e1698a2775779ce6e7a98e60c8f06fd6a374d), [`663e08e`](https://github.com/forinda/clarusjs/commit/663e08e0c7949edf33d8fe63ddca2b4f9f96d224)]:
  - clarusjs@0.17.0

## 0.5.0

### Minor Changes

- [#511](https://github.com/forinda/clarusjs/pull/511) [`5be4c5e`](https://github.com/forinda/clarusjs/commit/5be4c5e0ff310c14b3c83bef1c928955ffd81cb7) Thanks [@forinda](https://github.com/forinda)! - Version badges in Markdown: `{since=0.16.0}`, `{deprecated=0.17.0}` and `{removed=0.18.0}` (combinable: `{deprecated=0.17.0 removed=0.18.0}`) after a heading, in a table cell or in text render as `<span class="version" data-version="since">Since 0.16.0</span>`, left out of the heading's id, anchor label and the page's contents. The docs theme styles them.

### Patch Changes

- Updated dependencies [[`0086d3b`](https://github.com/forinda/clarusjs/commit/0086d3bdfa34c966d143f4f008226f8547ad6023), [`e32325f`](https://github.com/forinda/clarusjs/commit/e32325fcc70f6fad75e184e60abc7aa2ad105b16), [`98d3f38`](https://github.com/forinda/clarusjs/commit/98d3f38b2e1e098b1b98ba8ae6681610a599a1b3), [`2cb2c58`](https://github.com/forinda/clarusjs/commit/2cb2c5812318916cd72a5da13668f684418f83fa), [`3b770b3`](https://github.com/forinda/clarusjs/commit/3b770b3a142b5067ab8aa04d028aff6e750ce894), [`2181938`](https://github.com/forinda/clarusjs/commit/21819387c6ea835e43e9c97258228c0aa92c773a), [`6641e73`](https://github.com/forinda/clarusjs/commit/6641e7352eff45c97d419cc8c8a676669f95506c)]:
  - clarusjs@0.16.0

## 0.4.2

### Patch Changes

- Updated dependencies [[`0a9f2fb`](https://github.com/forinda/clarusjs/commit/0a9f2fbf6de7360750556f1c2c028e55be08296b), [`7e8c056`](https://github.com/forinda/clarusjs/commit/7e8c05654d6474e125b71b29ce4a6a19b9eb0f2a), [`40078ff`](https://github.com/forinda/clarusjs/commit/40078ffcfbdde79f96171b551ef2781b8950b4c9), [`c0d028f`](https://github.com/forinda/clarusjs/commit/c0d028fc70e8c11c4d98ce9f6b32c6ff2699d755), [`6d54f6f`](https://github.com/forinda/clarusjs/commit/6d54f6f1e610b5449a7caeb68ed50767dede92a7), [`b02ebc8`](https://github.com/forinda/clarusjs/commit/b02ebc83e348a81cd71e1e437902ec43bb71ad66), [`59426c5`](https://github.com/forinda/clarusjs/commit/59426c556d136bcc524a51b3dcd296f7f82bca23), [`e309175`](https://github.com/forinda/clarusjs/commit/e309175374892619d6d5a35f364ed93838851043), [`e61e09c`](https://github.com/forinda/clarusjs/commit/e61e09c6e2cece2d8a051f095afd075e1788e042), [`4324103`](https://github.com/forinda/clarusjs/commit/4324103b08cf161331e47c9b1e742fa918de5238), [`27a6a53`](https://github.com/forinda/clarusjs/commit/27a6a5333e6bdb371d5c7509eed4b8ea56d0f195), [`a8ea351`](https://github.com/forinda/clarusjs/commit/a8ea3512a4807e3398b01b4747fc027d29222976)]:
  - clarusjs@0.15.0

## 0.4.1

### Patch Changes

- Updated dependencies [[`e78455e`](https://github.com/forinda/clarusjs/commit/e78455e2518ff3a9cfacb7b02aeb814764c00ef0), [`a0ee549`](https://github.com/forinda/clarusjs/commit/a0ee549af5a36b7b4ace50ab42627acd102d7259), [`39e91e8`](https://github.com/forinda/clarusjs/commit/39e91e85b3c7a20be06f8575083f1e000ac22318), [`e22f57a`](https://github.com/forinda/clarusjs/commit/e22f57a12aa241c1d5f8033d35a437cc64d4e3e0), [`8215ea7`](https://github.com/forinda/clarusjs/commit/8215ea7cdbe851e8dbaf845601fbad5becdee2d0), [`f194846`](https://github.com/forinda/clarusjs/commit/f1948466a96d486f3067171c51290bb0297be839)]:
  - clarusjs@0.14.0

## 0.4.0

### Minor Changes

- [#382](https://github.com/forinda/clarusjs/pull/382) [`7e74f84`](https://github.com/forinda/clarusjs/commit/7e74f845340fa99b09a99e0fb74ee3b7522e420e) Thanks [@forinda](https://github.com/forinda)! - `markdown({ lineNumbers: true })` numbers the lines of every code block except shell commands (`sh`, `bash`, `shell`, `zsh`, `console`, `powershell`, `ps1`). A shell script is numbered: a block with a file title (`[deploy.sh]`) or a `#!` first line. `:no-line-numbers` after the language turns one block off; `:line-numbers` still turns one on.

- [#396](https://github.com/forinda/clarusjs/pull/396) [`e8734bf`](https://github.com/forinda/clarusjs/commit/e8734bf2f3e2b512b45949522500ace2ccdc7bfb) Thanks [@forinda](https://github.com/forinda)! - A page sets its own sitemap date: `<cl-head><meta name="sitemap:lastmod" content="2026-11-01"></cl-head>` (or `lastmod:` in Markdown frontmatter) wins over the git date and is removed from the built page; a value that isn't a date fails the build, naming the page.

### Patch Changes

- [#388](https://github.com/forinda/clarusjs/pull/388) [`e345799`](https://github.com/forinda/clarusjs/commit/e345799f64702bd5140f8bbca742c933beac1d7a) Thanks [@forinda](https://github.com/forinda)! - Accessibility fixes from a full audit of clarusjs.com. Theme: on phones the header's search button keeps its "Search" name for screen readers (the label is hidden visually, not removed), and a lesson's step segments are 24px tap targets (the bars still draw 8px high). Content: Markdown tables take focus (`tabindex="0"`), so one that scrolls sideways on a small screen can be scrolled from the keyboard.
- Updated dependencies [[`01f21e4`](https://github.com/forinda/clarusjs/commit/01f21e454db0bdf81d405c8ff580a6847e6b51b0), [`77853de`](https://github.com/forinda/clarusjs/commit/77853decd380c972d094bdb871f90f4479029548), [`6cc6ec9`](https://github.com/forinda/clarusjs/commit/6cc6ec95031e6f963ceba74af85f5cb90aad6ba2), [`e5650c7`](https://github.com/forinda/clarusjs/commit/e5650c787206ce8a13cf26613f02a47659c94c19), [`3a302a4`](https://github.com/forinda/clarusjs/commit/3a302a419ef8b341866c661e9b04dad94f7b541f), [`e87ad85`](https://github.com/forinda/clarusjs/commit/e87ad8538c44ec5327097fb33cfd4702066fad30), [`b1d211f`](https://github.com/forinda/clarusjs/commit/b1d211f2192d3e379d834bf442ca932fcba16547), [`4d93a7b`](https://github.com/forinda/clarusjs/commit/4d93a7bfb58663d8f01f9c3b0c9767740827fb5d), [`96d7ea1`](https://github.com/forinda/clarusjs/commit/96d7ea13dbe40ec8ee395374cb84d6beba68d396), [`e8734bf`](https://github.com/forinda/clarusjs/commit/e8734bf2f3e2b512b45949522500ace2ccdc7bfb), [`dff8f40`](https://github.com/forinda/clarusjs/commit/dff8f40dcd4f0b2cbf8cafd6dbe990462eb77212), [`c5dd711`](https://github.com/forinda/clarusjs/commit/c5dd711258cab06354c990cda5b7c87d728ca1c7), [`6fd8398`](https://github.com/forinda/clarusjs/commit/6fd839848dbbeb34db573f2f8ae25c1d5f29757c), [`2bc1db9`](https://github.com/forinda/clarusjs/commit/2bc1db9f298d9e07e77d8a44d8dd32f3c90f4d85)]:
  - clarusjs@0.13.0

## 0.3.1

### Patch Changes

- Updated dependencies [[`dd107bb`](https://github.com/forinda/clarusjs/commit/dd107bbdedc950fbcf9b120a9bb5569bf9f348cf), [`7daaabe`](https://github.com/forinda/clarusjs/commit/7daaabe2d7eac69e57fe2744b94bd2c36a7945cd), [`5d58103`](https://github.com/forinda/clarusjs/commit/5d5810381b0455a534d434a4a67b72e96bbc70b4)]:
  - clarusjs@0.12.0

## 0.3.0

### Minor Changes

- [#323](https://github.com/forinda/clarusjs/pull/323) [`d0ef9ec`](https://github.com/forinda/clarusjs/commit/d0ef9ec37598ffe01b2bddaaaaf948d9a22b71a5) Thanks [@forinda](https://github.com/forinda)! - `highlightTemplates()`: a Vite plugin (add it before clarusjs) that highlights code blocks in `.tscl` templates at build time with the same Shiki setup, themes and wrapper as Markdown. Mark a block with its language: `<pre><code verbatim lang="ts">…</code></pre>`, or `<pre verbatim lang="tscl">` for a sample holding `</code>`. Blocks with `{{ }}` holes are left as written, with a build warning; clarusjs itself never loads Shiki.

- [#324](https://github.com/forinda/clarusjs/pull/324) [`2ff6bef`](https://github.com/forinda/clarusjs/commit/2ff6bef98b2b446e85ed27df28a0105d3f87a599) Thanks [@forinda](https://github.com/forinda)! - `markdown({ components: '/src/components' })` (or several folders): a Markdown page uses a component by its tag without an `@import` line. `<counter />` imports `counter.tscl`, `<todoSummary />` `todo-summary.tscl`. An explicit `@import` wins, HTML's own elements and tags in code are skipped, and an unknown camelCase tag fails the build naming the page and the tag.

### Patch Changes

- Updated dependencies [[`d1aa9d1`](https://github.com/forinda/clarusjs/commit/d1aa9d1b8314d9c8541bcc2f4139e2e5f81077f1), [`ece99b7`](https://github.com/forinda/clarusjs/commit/ece99b712d31942c13001003779bd337081bd094), [`3ed3004`](https://github.com/forinda/clarusjs/commit/3ed3004422470311b0f88bd1dbf3d2f477e990bd), [`061d0f7`](https://github.com/forinda/clarusjs/commit/061d0f79a60a7349ae1eb3785fcbf02fd93191e0), [`5d4d1ce`](https://github.com/forinda/clarusjs/commit/5d4d1ce3987f5a6742bae3c92e88f73397c5de0c), [`d4af927`](https://github.com/forinda/clarusjs/commit/d4af927b6a27a69339941aa480a471b55c273038), [`16c619f`](https://github.com/forinda/clarusjs/commit/16c619fa42a7336c7a247fb125edbbb031445268), [`79315ea`](https://github.com/forinda/clarusjs/commit/79315ead6668ca60da0a280ae15abdd8f2e4082d), [`aa69dae`](https://github.com/forinda/clarusjs/commit/aa69dae9a04403747a334a3c4b8f87985842a4f7), [`29b7974`](https://github.com/forinda/clarusjs/commit/29b79748a27b0aa14aa26469481bc27ee0e993e7)]:
  - clarusjs@0.11.0

## 0.2.3

### Patch Changes

- [#295](https://github.com/forinda/clarusjs/pull/295) [`acedce0`](https://github.com/forinda/clarusjs/commit/acedce0ecd1d7140a119da47a140ac4857e143a9) Thanks [@forinda](https://github.com/forinda)! - Editor hovers for `clarusjs/compiler` (`compile()`, `parse()`, `ClarusError` and the syntax-tree types) and `@clarusjs/content` (`markdown()`, its options, `slugify()`): JSDoc with examples, linking new reference pages (https://clarusjs.com/reference/compiler, https://clarusjs.com/reference/content). Every public export of both packages is now documented.

- [#285](https://github.com/forinda/clarusjs/pull/285) [`4dc4299`](https://github.com/forinda/clarusjs/commit/4dc42992241a97e9717ae12d8af7976094b11e00) Thanks [@forinda](https://github.com/forinda)! - A `::: quiz` rendered through a quiz component shows its question and options as written: `` `<script>` `` in an option now reads `<script>`, not `&lt;script&gt;`. The text was HTML-escaped into a JavaScript binding, then escaped again by the template.
- Updated dependencies [[`efb8968`](https://github.com/forinda/clarusjs/commit/efb89684964711686781c7b4774f184b93f95f9f), [`40815e7`](https://github.com/forinda/clarusjs/commit/40815e7afe1d77a618ebb97e3216e89a354d332f), [`ff3b28c`](https://github.com/forinda/clarusjs/commit/ff3b28cf3b87ec28fd2f0c623a20cab7e2962ab3), [`60852d9`](https://github.com/forinda/clarusjs/commit/60852d9afcfb60075bb5883df584ddbfb3baf1b9), [`58fb1e6`](https://github.com/forinda/clarusjs/commit/58fb1e6affe9a17db0c365a33916c8b7c7779c2b), [`dcd5683`](https://github.com/forinda/clarusjs/commit/dcd5683000ea50a7b422ab812941fb501f258737), [`acedce0`](https://github.com/forinda/clarusjs/commit/acedce0ecd1d7140a119da47a140ac4857e143a9), [`69fa594`](https://github.com/forinda/clarusjs/commit/69fa5943f84c5386a340758836c7571608e7eab0), [`d99b7bc`](https://github.com/forinda/clarusjs/commit/d99b7bcf28d92f3714cb0095d860d533567c5db9), [`435cbaa`](https://github.com/forinda/clarusjs/commit/435cbaa88a8bc16f7a9996d4ca1faf73ab0bd89e), [`2574332`](https://github.com/forinda/clarusjs/commit/25743326322c9bc31f4da6e6c0301ed2df31b575), [`516a33c`](https://github.com/forinda/clarusjs/commit/516a33cc5ff28099d16ead9afafd058a820b499d), [`24543cd`](https://github.com/forinda/clarusjs/commit/24543cdace11661cf56c96fa5ecc1be76a09a2cd), [`3f6853c`](https://github.com/forinda/clarusjs/commit/3f6853c795dedbabed1d776ead9f56b3961b49e5)]:
  - clarusjs@0.10.0

## 0.2.2

### Patch Changes

- [#214](https://github.com/forinda/clarusjs/pull/214) [`c0d92fa`](https://github.com/forinda/clarusjs/commit/c0d92fa9f6b92f6cc1a645f6057bf8f53c8ef806) Thanks [@forinda](https://github.com/forinda)! - Frontmatter schemas: `markdown({ schema })` validates each page's frontmatter with any Standard Schema (Zod, Valibot, ArkType…), one for every page or one per folder glob under `src/pages`. A page that doesn't match fails the build with `file: frontmatter.key: message`; the schema's output (defaults, coercions) is what the page gets. No schema library dependency.
- Updated dependencies [[`7a38592`](https://github.com/forinda/clarusjs/commit/7a385924e5900383ee9219f7e36d999e3b74591e), [`bf8c684`](https://github.com/forinda/clarusjs/commit/bf8c68430cd3f122c48403061e78362626cb9b51), [`61a3ffd`](https://github.com/forinda/clarusjs/commit/61a3ffd3410ebe589c7fb29f1249b59a08a16620), [`80f961c`](https://github.com/forinda/clarusjs/commit/80f961cf0963e42508eabbc23b4cd1ec8e05041b), [`7009b8c`](https://github.com/forinda/clarusjs/commit/7009b8cc7bf75ebe2dfdefae9d87c31eb824f297), [`e56bbc1`](https://github.com/forinda/clarusjs/commit/e56bbc16eaa243909a6a571d7bffb44a5bd6ece3), [`ddcf28b`](https://github.com/forinda/clarusjs/commit/ddcf28b1b996a833007f1c49de4f52f886b2b9f7), [`82b7f6f`](https://github.com/forinda/clarusjs/commit/82b7f6f9e99bdd8c0691509e56ff7e5db8d4d3ba), [`5fffc7d`](https://github.com/forinda/clarusjs/commit/5fffc7d28f5e50664a4b81f2e189fa5d59a47ce3), [`a9f2c81`](https://github.com/forinda/clarusjs/commit/a9f2c8181a68b9afd51f0cb9e71a2efdacc9a02e), [`4c40fa8`](https://github.com/forinda/clarusjs/commit/4c40fa80fe2f57c425d7c1d569c132aa078eec6c), [`54297d3`](https://github.com/forinda/clarusjs/commit/54297d34a7003649a211a7bf2c16c830751da898), [`bb0f81f`](https://github.com/forinda/clarusjs/commit/bb0f81fd490e72c3b29cf4bb44a7df2cf54482c2), [`358f9ae`](https://github.com/forinda/clarusjs/commit/358f9ae3a087fa6ab5193f61151223dd998e81f1), [`44fd0fb`](https://github.com/forinda/clarusjs/commit/44fd0fb0c373a758c0ac99548f47563696a6fbc0), [`12b8958`](https://github.com/forinda/clarusjs/commit/12b8958c3880e2d5017c0fd3179c20f0708ad5a1), [`349cbd7`](https://github.com/forinda/clarusjs/commit/349cbd7be506893b0da3a698fc2b6868bd051861), [`0138f4c`](https://github.com/forinda/clarusjs/commit/0138f4c5614351597701ff76e75eb619fa0f57ff), [`ade6f06`](https://github.com/forinda/clarusjs/commit/ade6f0677169a74ff2c4c4f5204bd4d7ecb45067), [`0d40714`](https://github.com/forinda/clarusjs/commit/0d40714ab77e0cad96f861f5dcdd35567b797b19), [`048b058`](https://github.com/forinda/clarusjs/commit/048b05807649e2fdce117e9f4d27c1b9a7f5c37a), [`983bd03`](https://github.com/forinda/clarusjs/commit/983bd03934fdeadb199f65f56e198bbfd8f0b6f2), [`6975d9e`](https://github.com/forinda/clarusjs/commit/6975d9eac1c7ebb3c8f0172ad43accb540a5260a), [`bcbda7d`](https://github.com/forinda/clarusjs/commit/bcbda7da92db7c10d823949d5f4fc8c2d2049cad), [`f6cbb76`](https://github.com/forinda/clarusjs/commit/f6cbb769244967f587dd52f38c977de0df89562f), [`63a125b`](https://github.com/forinda/clarusjs/commit/63a125b6ba20497904b80143d8eb4d2d77322d51), [`3c42922`](https://github.com/forinda/clarusjs/commit/3c42922919566d8ed62e3254beacf10dc8d2a9f8)]:
  - clarusjs@0.9.0

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
