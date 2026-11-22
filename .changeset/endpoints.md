---
"clarusjs": minor
---

Endpoints: a `.ts` file under `src/pages` (not `.load.ts`) exporting `GET`, `POST`, `PUT`, `PATCH`, `DELETE` or `OPTIONS` handlers answers at its route, with the same context as `load()` (request, params, cookies, locals), served by the same handler in dev, preview and production (and the Netlify adapter). Cross-site writes are refused (403) by an `Origin` / `Sec-Fetch-Site` check; `HEAD` falls back to `GET`; other methods get 405 with `Allow`. Request bodies now reach the handler in dev and `vite preview`. New type: `RequestHandler`.
