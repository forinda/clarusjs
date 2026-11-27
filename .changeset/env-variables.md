---
'clarusjs': minor
---

Environment variables: in dev, build and preview, `.env` files' variables reach server code through `process.env` (never overriding the host's). New `env` plugin option names required variables (`{ server, browser }`): the build fails naming any that is missing, and `.clarusjs/env.d.ts` types them. New lint rule `server-env-in-browser` (an error by default): `process.env`, or an unprefixed `import.meta.env` variable, read in a browser script.
