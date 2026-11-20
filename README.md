# clarujs

Clear, compiled views (inspired by KickJS views): `.kvw` components compiled to server HTML plus tiny attach-only islands, hosted by Vite.

Status: proof of concept. Read [docs/architecture.md](docs/architecture.md) for the design.

## Quickstart

```sh
npm install
npm test        # compiler, runtime and an end-to-end test against a real Vite dev server
npm run dev     # serves examples/counter
```

## What to look at

- **`examples/counter/src`**: one page, one stateless component (`greeting`), one stateful component (`counter`).
- **View source** in the browser: the `<h1>` and greeting are plain HTML with no markers. Each counter is a
  `<kv-island c src p>` with `<!--[n-->…<!--]-->` around its reactive text only.
- **Network tab**: the page loads `kv-loader.js`, which fetches `counter.kvw?import` (the counter's `attach` function)
  and clarujs's runtime. No JS for the page or the greeting. (`/@vite/client` is Vite's dev-only HMR client.)
- **Compiled output**: `GET /src/components/counter.kvw?import` in the dev server shows the client module.
  The server module has the same shape with `render()`; see `test/compiler/emit-server.test.ts`.
