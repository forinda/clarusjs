<p align="center">
  <img src="docs/assets/logo.svg" width="120" height="120" alt="clarusjs logo">
</p>

<h1 align="center">clarusjs</h1>

<p align="center"><strong>Clear, compiled views.</strong></p>

<p align="center"><a href="https://clarusjs.com">Documentation</a> · <a href="https://clarusjs.com/guide/getting-started">Getting started</a> · <a href="https://www.npmjs.com/package/clarusjs">npm</a></p>

<p align="center"><a href="https://www.npmjs.com/package/clarusjs"><img src="https://img.shields.io/npm/dm/clarusjs?label=downloads%2Fmonth" alt="clarusjs monthly downloads on npm"></a> <a href="https://www.npmjs.com/package/clarusjs"><img src="https://img.shields.io/npm/v/clarusjs" alt="clarusjs version on npm"></a></p>

Write components once in a familiar template language. clarusjs compiles them to plain server HTML, and ships
JavaScript only for the parts that are actually interactive. Static sites, server rendering and client apps share one
component model, and you can always see where each line runs.

> Status: early (`0.x`). The API will change between minor versions. The design lives in [docs/architecture.md](docs/architecture.md).

## The name

**clarus** is Latin for *clear, bright, plain to see* (***clārus***). Clarity is the promise: templates that are clear
to read, output that is clear to follow, and no guessing about whether code runs on the server, at build time or in
the browser. The logo spells **TSCL**, the `.tscl` file extension: a clear cut stone, flat along a **T**, struck by an
**S**-shaped lightning bolt, with **C** and **L** down the stem. Clear HTML all the way through, and a spark of
interactivity only where a page needs one. **.js** because it is, in the end, just JavaScript you can open and read.

## Principles

- **Checked at build time.** Templates and their typed inputs are checked before anything ships, with errors at `file.tscl:line:col`.
- **One template syntax.** `{{ }}` holes, `@if` / `@for`, `(event)` and `[prop]`, the same on the server and in the browser.
- **The compiler does the work.** Signals are written as plain variables; the output is HTML plus small, readable modules.
- **Static by default.** JavaScript ships only for the interactive islands a page has.
- **Navigation without a framework router.** Pages swap server-rendered fragments; a client router runs only for routes that need one.

## What it looks like

```kick
{{-- components/counter.tscl --}}
@input start: number = 0

<script>
  let count = state(start)
  const double = derived(() => count * 2)
  function add() { count++ }
</script>

<button (click)="add()">Clicked {{ count }} times (double: {{ double }})</button>
```

A component without `<script>` is HTML only, forever, at zero JavaScript cost. A component with state is rendered on
the server and then *attached* in the browser: no re-render and no hydration mismatches.

## Quickstart

```sh
pnpm install
pnpm test       # compiler, runtime and an end-to-end test against a real Vite dev server
pnpm dev        # serves examples/counter
```

## Docs

The docs site, [clarusjs.com](https://clarusjs.com), lives in [`packages/docs`](packages/docs) and is built with clarusjs itself. Run it with `pnpm docs:dev`.
It doubles as the end-to-end test of the framework: `pnpm docs:test` builds it and checks it in a real browser.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests and changesets, and [AGENTS.md](AGENTS.md) for the layout and
the rules the code follows. Report security problems privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
