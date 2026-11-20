# clarusjs

## 0.2.0

### Minor Changes

- [#5](https://github.com/forinda/clarusjs/pull/5) [`0bec5ce`](https://github.com/forinda/clarusjs/commit/0bec5ceac79f30a327a8d3e301133cc8a9e890d8) Thanks [@forinda](https://github.com/forinda)! - Static sites: `vite build` now builds the client and server and prerenders every page to `dist/client/<route>/index.html`, and `vite preview` serves those pages at their routes. Stateless components can wrap content with a default `<slot />`, and a page whose layout renders `<html>` becomes the whole document (doctype added, island style and loader injected where they belong).

### Patch Changes

- [#5](https://github.com/forinda/clarusjs/pull/5) [`e3bc637`](https://github.com/forinda/clarusjs/commit/e3bc637077608edb36db950a92dca98290866ad6) Thanks [@forinda](https://github.com/forinda)! - The package now ships its own README, so the npm page shows install and usage instructions.

## 0.1.0

### Minor Changes

- [#1](https://github.com/forinda/clarusjs/pull/1) [`1c65b70`](https://github.com/forinda/clarusjs/commit/1c65b706ce27259a8cb1c26b46d64a87a178bcbc) Thanks [@forinda](https://github.com/forinda)! - First proof of concept: `.clarus` components compiled to server HTML with attach-only islands, compiled signals, an island loader, a `fetch(Request)` handler and a Vite plugin.

### Patch Changes

- [#3](https://github.com/forinda/clarusjs/pull/3) [`8792fc3`](https://github.com/forinda/clarusjs/commit/8792fc33356086bc77a26bb60263695f51aa2ce3) Thanks [@forinda](https://github.com/forinda)! - The published package now contains compiled JavaScript and type declarations (`dist/`) instead of TypeScript sources, so it works in any Node or Vite project without a TypeScript loader.

- [#2](https://github.com/forinda/clarusjs/pull/2) [`94823b2`](https://github.com/forinda/clarusjs/commit/94823b20303b836903079bd244f17a85ec60823b) Thanks [@forinda](https://github.com/forinda)! - Licensed under MIT; the package now includes the LICENSE file.
