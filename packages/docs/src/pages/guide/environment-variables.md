---
title: "Environment variables"
group: "Build & deploy"
order: 2
description: "Which variables reach the browser and which stay on the server, .env files, and required variables, typed."
---

# Environment variables {since=0.17.0}

<p class="lead">Variables starting with <code>VITE_</code> reach the browser. Every other variable stays on the server.</p>

## On the server

Server code reads `process.env`. That covers `<script server>`, `load()`, endpoints, guards, `src/server.ts` and server routes.

```tscl [src/pages/account.tscl]
<script server>
  const res = await fetch(`${process.env.API_URL}/me`, { headers: { authorization: `Bearer ${process.env.API_KEY}` } })
  const me = await res.json()
</script>

<h1>Hello, {{ me.name }}</h1>
```

When a value is read depends on the route. A prerendered page reads it once, at `vite build`, and its value is baked into the HTML. A server route reads it on every request, from the host's environment. Either way, a secret read on the server never reaches the browser unless you render it.

## In the browser

A component's `<script>` runs in the browser, and so does `<script inline>`. There, `process.env` doesn't exist, and `import.meta.env` holds only the variables that start with `VITE_`, plus Vite's own `MODE`, `DEV`, `PROD`, `SSR` and `BASE_URL`. Vite writes them into the JavaScript at build time, so anyone can read them: never give a secret the `VITE_` prefix.

```tscl [src/components/search-box.tscl]
<script>
  const endpoint = import.meta.env.VITE_SEARCH_URL
  let results = state([])
</script>
```

`clarusjs check` reports reading `process.env`, or an unprefixed `import.meta.env` variable, in a browser script. The rule is [`server-env-in-browser`](/guide/lint#rules), an error by default, because the value would be `undefined` there.

## .env files

In development, at `vite build` and in `vite preview`, variables come from these files in the project folder. A later file wins:

| File | Loaded |
|---|---|
| `.env` | always |
| `.env.local` | always; keep it out of git |
| `.env.[mode]` | in that mode: `development` for `vite`, `production` for `vite build`, or `--mode staging` |
| `.env.[mode].local` | in that mode; keep it out of git |

`VITE_` variables go to `import.meta.env`, as Vite does. clarusjs puts every other variable in `process.env` for server code. A variable already set in the environment is never overridden, so the host's value wins over a file.

```sh [.env]
API_URL=https://api.example.com
API_KEY=dev-key
VITE_SEARCH_URL=/api/search
```

In production, the host sets the variables. `clarusjs serve` doesn't read `.env` files: use the host's settings, `docker run -e API_KEY=…`, or `node --env-file=.env node_modules/.bin/clarusjs serve`.

## Required variables, typed

Name the variables your site needs in the plugin's `env` option:

```ts [vite.config.ts]
clarusjs({
  env: {
    server: ['API_URL', 'API_KEY'],
    browser: ['VITE_SEARCH_URL'],
  },
})
```

`vite build` then fails while any of them is missing, naming each one. The dev server warns instead. A browser variable must start with `VITE_`. The build, the dev server and `clarusjs check` also write `.clarusjs/env.d.ts`, which types each variable as a `string`. Add the file to your tsconfig:

```json [tsconfig.json]
{ "include": ["src", ".clarusjs/env.d.ts"] }
```

`process.env.API_KEY` is then a `string`, not `string | undefined`, and `import.meta.env.VITE_SEARCH_URL` is known. A typo is a type error.
