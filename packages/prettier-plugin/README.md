# @clarusjs/prettier-plugin

Format [clarusjs](https://github.com/forinda/clarusjs) `.tscl` components with Prettier: the template is indented like HTML, `<script>` is formatted as JavaScript and `<style>` as CSS, with your project's Prettier options.

```sh
pnpm add -D prettier @clarusjs/prettier-plugin
```

```json
// .prettierrc
{ "plugins": ["@clarusjs/prettier-plugin"] }
```

```sh
npx prettier --write "src/**/*.tscl"
```

Directives at the top (`@import`, `@input`…), `{{-- --}}` comments and `verbatim` contents are kept as written. With the clarusjs language server, Format Document uses the same Prettier and config. See the [Formatting guide](https://clarusjs.com/guide/formatting).

MIT licensed.
