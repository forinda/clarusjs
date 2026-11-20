---
title: "Deploying"
description: "Upload dist/client to any static host; this site deploys to Netlify."
---

# Deploying

<p class="lead">Upload <code>dist/client/</code> to any static host.</p>

## Netlify

This site deploys to Netlify:

```toml
# netlify.toml
[build]
  command = "pnpm install --frozen-lockfile && pnpm --filter @clarusjs/docs build"
  publish = "packages/docs/dist/client"
```

::: info
The same handler can also run on a server per request. Choosing between build time and request time per route is coming in a later release.
:::
