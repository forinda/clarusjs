# clarusjs

**Clear, compiled views.** Write components once in a familiar template language. clarusjs compiles them to plain
server HTML, and ships JavaScript only for the parts that are actually interactive. Static sites, server rendering and
client apps share one component model, and you can always see where each line runs.

> Status: proof of concept. The design lives in [docs/architecture.md](docs/architecture.md).

## The name

<p align="center">
  <img src="docs/assets/clarusjs-origin.svg" alt="clārus (Latin: clear, bright, plain to see) becomes clarus.js. It draws on KickJS views, Vue and Angular, Svelte, Astro, and htmx with Turbo." width="880">
</p>

**clarus** is Latin for *clear, bright, plain to see* (***clārus***). Clarity is the promise: templates that are clear
to read, output that is clear to follow, and no guessing about whether code runs on the server, at build time or in
the browser. **.js** because it is, in the end, just JavaScript you can open and read.

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
npm install
npm test        # compiler, runtime and an end-to-end test against a real Vite dev server
npm run dev     # serves examples/counter
```

## What to look at

- **`examples/counter/src`**: one page, one stateless component (`greeting`), one stateful component (`counter`).
- **View source** in the browser: the `<h1>` and greeting are plain HTML with no markers. Each counter is a
  `<cl-island c src p>` with `<!--[n-->…<!--]-->` around its reactive text only.
- **Network tab**: the page loads `cl-loader.js`, which fetches `counter.clarus?import` (the counter's `attach` function)
  and the clarusjs runtime. No JS for the page or the greeting. (`/@vite/client` is Vite's dev-only HMR client.)
- **Compiled output**: `GET /src/components/counter.clarus?import` in the dev server shows the client module.
  The server module has the same shape with `render()`; see `test/compiler/emit-server.test.ts`.

## Contributing

See [AGENTS.md](AGENTS.md) for the layout, commands and the rules the code follows (they apply to people too).
