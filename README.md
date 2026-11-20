<p align="center">
  <img src="docs/assets/logo.svg" width="120" height="120" alt="clarusjs logo: a clear cut crystal with one bright facet">
</p>

<h1 align="center">clarusjs</h1>

<p align="center"><strong>Clear, compiled views.</strong></p>

Write components once in a familiar template language. clarusjs compiles them to plain server HTML, and ships
JavaScript only for the parts that are actually interactive. Static sites, server rendering and client apps share one
component model, and you can always see where each line runs.

> Status: proof of concept. The design lives in [docs/architecture.md](docs/architecture.md).

## The name

**clarus** is Latin for *clear, bright, plain to see* (***clārus***). Clarity is the promise: templates that are clear
to read, output that is clear to follow, and no guessing about whether code runs on the server, at build time or in
the browser. The logo is a clear cut stone with one bright facet: pages that are plain HTML all the way through, with
a small live core where they are interactive. **.js** because it is, in the end, just JavaScript you can open and read.

clarusjs borrows openly from projects that got one thing very right:

| From | What clarusjs takes |
|---|---|
| **KickJS views** | templates checked at build time, typed inputs, `@fragment`-style partial renders |
| **Vue · Angular** | an approachable template syntax: `{{ }}`, `@if` / `@for`, `(event)`, `[prop]` |
| **Svelte** | a compiler that does the heavy lifting, and signals written as plain variables |
| **Astro** | static by default, with interactive islands only where needed |
| **htmx · Turbo** | navigation by swapping server-rendered fragments, no client router required |

## What it looks like

```kick
{{-- components/counter.clarus --}}
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

The docs site lives in [`packages/docs`](packages/docs) and is built with clarusjs itself. Run it with `pnpm docs:dev`.
It doubles as the end-to-end test of the framework: `pnpm docs:test` builds it and checks it in a real browser.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests and changesets, and [AGENTS.md](AGENTS.md) for the layout and
the rules the code follows. Report security problems privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
