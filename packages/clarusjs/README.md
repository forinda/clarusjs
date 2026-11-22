<p align="center">
  <img src="https://raw.githubusercontent.com/forinda/clarusjs/main/docs/assets/logo.svg" width="96" height="96" alt="clarusjs logo">
</p>

<h1 align="center">clarusjs</h1>

<p align="center"><strong>Clear, compiled views.</strong></p>

<p align="center">Pronounced <strong>KLAIR-us</strong> (/ˈklɛər.əs/), from the Latin <em>clarus</em>, “clear, bright”.</p>

<p align="center"><a href="https://clarusjs.com">Documentation</a> · <a href="https://clarusjs.com/guide/getting-started">Getting started</a> · <a href="https://www.npmjs.com/package/clarusjs">npm</a></p>

Write components in a familiar template language. clarusjs compiles them to plain server HTML and ships JavaScript
only for the parts that are interactive. Static sites, server rendering and client apps share one component model,
and you can always see where each line runs.

> Status: early (`0.x`). The API will change between minor versions.

## Install

```sh
pnpm add clarusjs
pnpm add -D vite
```

## Use

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'

export default defineConfig({ plugins: [clarusjs()] })
```

```clarus
{{-- src/components/counter.tscl --}}
@input start: number = 0

<script>
  let count = state(start)
  function add() { count++ }
</script>

<button (click)="add()">Clicked {{ count }} times</button>
```

```clarus
{{-- src/pages/index.tscl --}}
@import counter from '../components/counter.tscl'

<h1>Hello</h1>
<counter [start]="1" />
```

- `vite` serves `src/pages/**/*.tscl` as routes, rendered on the server.
- `vite build` writes a static site to `dist/client/`: one HTML file per page, plus JavaScript only for components
  with a `<script>` (the counter above). The `<h1>` ships no JavaScript at all.

## Links

- Repository and design: [github.com/forinda/clarusjs](https://github.com/forinda/clarusjs)
- Contributing: [CONTRIBUTING.md](https://github.com/forinda/clarusjs/blob/main/CONTRIBUTING.md)
- Security: [SECURITY.md](https://github.com/forinda/clarusjs/blob/main/SECURITY.md)
- License: MIT
