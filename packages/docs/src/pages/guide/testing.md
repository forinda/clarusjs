---
title: "Testing"
group: "Site quality"
order: 3
description: "Test what your components render with Vitest, their interactive parts in a real browser with Playwright, and run both in CI with clarusjs check."
---

# Testing

<p class="lead">A component is HTML from the server plus, where it's interactive, a little JavaScript in the browser. Test the HTML with Vitest, the interactive parts in a browser with Playwright, and let <code>clarusjs check</code> catch type and template errors.</p>

The examples on this page are the files this site runs in its own tests, so they work as shown.

## Set up

Install Vitest and add the clarusjs plugin to its config: the plugin compiles the `.tscl` files your tests import, the same way Vite does for your site.

```sh
pnpm add -D vitest
```

<<< ../../../test/guide/vitest.config.example.ts [vitest.config.ts]

## Test what a component renders

Import a component and call its `render(props, slots, attributes)`: it returns the HTML the server would send. Check what matters to you: the text, the attributes, what's escaped.

<<< ../../../test/guide/greeting.tscl [greeting.tscl]

<<< ../../../test/guide/greeting.test.ts [greeting.test.ts]

- **`props`** are the component's inputs.
- **`slots`** map slot names to HTML: `default` for `<slot />`, and a name for each named slot.
- **Attributes written on the tag** (`class`, `id`, `style`, `aria-*`, `data-*`) are the third argument. See [Components](/guide/components#attributes-on-a-component) for where they land.
- `render` can return a promise (a component that awaits data does): `await` it either way.

## Test islands in a browser

An island's behaviour (clicks, typing, two-way binding, keyboard) runs in the browser, so test it in one. Playwright drives a real browser against your built site; `@axe-core/playwright` checks each page for accessibility problems while you're there (see [Accessibility](/guide/accessibility)).

```sh
pnpm add -D @playwright/test @axe-core/playwright
pnpm exec playwright install chromium
```

Point Playwright's `webServer` at your built site (`vite build && vite preview`), then test what a visitor does:

<<< ../../../e2e/guide-testing.spec.ts [e2e/counter.spec.ts]

- **Wait for the island to attach** before you interact: `data-cl-ready` appears on its `<cl-island>` once its JavaScript has run.
- **Test the built site**, not the dev server: it's what you ship, and it's what `vite preview` serves.

## In CI

Run all three on every change:

```sh
pnpm exec clarusjs check   # type and template errors, at file.tscl:line:col
pnpm exec vitest run       # what components render
pnpm exec playwright test  # islands and accessibility, in a browser
```

## Not covered yet

There's no helper yet for clicking an island without a browser: a component's browser code isn't available to Vitest. Test interactive behaviour with Playwright as above. If you'd use a faster way, say so in an issue.
