---
"clarusjs": minor
---

Cookies and locals in loaders, with a request hook: every `load()` gets `cookies` (`get`, `getAll`, `set`, `delete`; what's set goes on the answer as `Set-Cookie`, with secure defaults: `path: '/'`, `httpOnly`, `sameSite: 'lax'`, and `secure` everywhere but the Vite dev server) and `locals`. An optional `src/server.ts` exports `handle({ request, cookies, locals })`, run once per request before any page loads; returning a Response (such as `redirect('/login')`) answers instead. `Locals` is declared once with module augmentation and checked in every loader. New types: `LoadContext`, `Cookies`, `CookieOptions`, `Locals`, `Handle`.
