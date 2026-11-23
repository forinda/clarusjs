# @clarusjs/prettier-plugin

## 0.2.0

### Minor Changes

- [#438](https://github.com/forinda/clarusjs/pull/438) [`e78455e`](https://github.com/forinda/clarusjs/commit/e78455e2518ff3a9cfacb7b02aeb814764c00ef0) Thanks [@forinda](https://github.com/forinda)! - `@await`, `@then` and `@catch` blocks ([#430](https://github.com/forinda/clarusjs/issues/430)): the Prettier plugin lays them out like `@if` / `@else` (headers kept as written), the language server hides them from the HTML service and completes the keywords, and the ESLint plugin reads their expressions.

### Patch Changes

- Updated dependencies [[`e78455e`](https://github.com/forinda/clarusjs/commit/e78455e2518ff3a9cfacb7b02aeb814764c00ef0), [`a0ee549`](https://github.com/forinda/clarusjs/commit/a0ee549af5a36b7b4ace50ab42627acd102d7259), [`39e91e8`](https://github.com/forinda/clarusjs/commit/39e91e85b3c7a20be06f8575083f1e000ac22318), [`e22f57a`](https://github.com/forinda/clarusjs/commit/e22f57a12aa241c1d5f8033d35a437cc64d4e3e0), [`8215ea7`](https://github.com/forinda/clarusjs/commit/8215ea7cdbe851e8dbaf845601fbad5becdee2d0), [`f194846`](https://github.com/forinda/clarusjs/commit/f1948466a96d486f3067171c51290bb0297be839)]:
  - clarusjs@0.14.0

## 0.1.0

### Minor Changes

- [#306](https://github.com/forinda/clarusjs/pull/306) [`092c66d`](https://github.com/forinda/clarusjs/commit/092c66d5723fc50122b0efaad0afb24cb008e191) Thanks [@forinda](https://github.com/forinda)! - New package: format `.tscl` components with Prettier. The template is formatted by Prettier's own HTML-template printer, `<script>` as JavaScript and `<style>` as CSS, with your Prettier options; directives, `{{-- --}}` comments and `verbatim` contents are kept as written.

### Patch Changes

- Updated dependencies [[`efb8968`](https://github.com/forinda/clarusjs/commit/efb89684964711686781c7b4774f184b93f95f9f), [`40815e7`](https://github.com/forinda/clarusjs/commit/40815e7afe1d77a618ebb97e3216e89a354d332f), [`ff3b28c`](https://github.com/forinda/clarusjs/commit/ff3b28cf3b87ec28fd2f0c623a20cab7e2962ab3), [`60852d9`](https://github.com/forinda/clarusjs/commit/60852d9afcfb60075bb5883df584ddbfb3baf1b9), [`58fb1e6`](https://github.com/forinda/clarusjs/commit/58fb1e6affe9a17db0c365a33916c8b7c7779c2b), [`dcd5683`](https://github.com/forinda/clarusjs/commit/dcd5683000ea50a7b422ab812941fb501f258737), [`acedce0`](https://github.com/forinda/clarusjs/commit/acedce0ecd1d7140a119da47a140ac4857e143a9), [`69fa594`](https://github.com/forinda/clarusjs/commit/69fa5943f84c5386a340758836c7571608e7eab0), [`d99b7bc`](https://github.com/forinda/clarusjs/commit/d99b7bcf28d92f3714cb0095d860d533567c5db9), [`435cbaa`](https://github.com/forinda/clarusjs/commit/435cbaa88a8bc16f7a9996d4ca1faf73ab0bd89e), [`2574332`](https://github.com/forinda/clarusjs/commit/25743326322c9bc31f4da6e6c0301ed2df31b575), [`516a33c`](https://github.com/forinda/clarusjs/commit/516a33cc5ff28099d16ead9afafd058a820b499d), [`24543cd`](https://github.com/forinda/clarusjs/commit/24543cdace11661cf56c96fa5ecc1be76a09a2cd), [`3f6853c`](https://github.com/forinda/clarusjs/commit/3f6853c795dedbabed1d776ead9f56b3961b49e5)]:
  - clarusjs@0.10.0
