---
title: "Auth and cookies"
group: "Build & deploy"
order: 5
description: "Where cookies, user data and tokens live in a clarusjs app, how to sign in with handle() and an endpoint, and how islands talk to the server."
---

# Auth and cookies

<p class="lead">A signed-in visitor is a cookie the server reads on each request. clarusjs gives every server route and endpoint the request's <code>cookies</code>, and an optional <code>handle()</code> that turns the cookie into <code>locals.user</code> once, before anything loads.</p>

## Where things live

| What | Static route | Server route | Island |
|---|---|---|---|
| **Runs** | once, at build, for everyone | on every request | in the browser |
| **Cookies** | none (reading them fails the build) | `cookies` in `load()` | sent along with its `fetch()` calls, never readable when HttpOnly |
| **The user** | none | `locals.user`, from `handle()` | what an endpoint answers |
| **Tokens for other APIs** | build-time secrets only | in server code | never: keep them in an endpoint |

Island props and state are written into the page's HTML, so anything you pass to an island is public. Pass the user's name to an island if you like, but never a token.

## Signing in

The pieces, each a few lines:

1. **`src/server.ts`** resolves the session on every request:

   ```ts
   import type { Handle } from 'clarusjs/server'

   declare module 'clarusjs/server' {
     interface Locals { user?: { id: string; name: string } }
   }

   export const handle: Handle = async ({ cookies, locals }) => {
     const session = cookies.get('session')
     if (session) locals.user = await sessions.find(session)
   }
   ```

2. **An endpoint** signs in: it checks the credentials, then sets an HttpOnly cookie holding a random session id (not the user's data):

   ```ts
   // src/pages/api/session.ts
   import type { RequestHandler } from 'clarusjs/server'

   export const POST: RequestHandler = async ({ request, cookies }) => {
     const { email, password } = await request.json()
     const user = await users.verify(email, password)
     if (!user) return Response.json({ error: 'Wrong email or password' }, { status: 401 })
     cookies.set('session', await sessions.create(user), { maxAge: 60 * 60 * 24 * 7 })
     return Response.json({ name: user.name })
   }

   export const DELETE: RequestHandler = async ({ cookies }) => {
     await sessions.end(cookies.get('session'))
     cookies.delete('session')
     return Response.json({ ok: true })
   }
   ```

3. **A server route** uses `locals.user`, and sends visitors who aren't signed in to the sign-in page:

   ```ts
   // src/pages/account.load.ts ('/account': 'server' in vite.config.ts)
   import { redirect, type LoadContext } from 'clarusjs/server'

   export function load({ locals }: LoadContext) {
     if (!locals.user) return redirect('/sign-in')
     return { name: locals.user.name }
   }
   ```

   To protect many routes at once, `handle()` can return that redirect itself.

Cookies are secure by default: `HttpOnly` (scripts can't read them), `SameSite=Lax`, `Secure`, and `Path=/`. See [cookies](/reference/server#cookies) in the server reference.

## Islands and endpoints

An island can't read an HttpOnly cookie, and shouldn't hold a token. It calls an endpoint with `fetch()`, the browser sends the cookie along, and the endpoint answers with what the island may see. Try it: sign in, reload the page, and you're still signed in. The cookie is the session.

<signInDemo />

The demo's endpoint is the one above, and `handle()` turns the cookie into `locals.user`, so the endpoint just reads `locals.user`. (In the demo, the "session" is your name itself, which is not something to copy: a real session cookie holds a random id.)

Endpoints refuse writes from other sites: a `POST` whose `Origin` isn't your site gets a 403. This blocks cross-site request forgery, where another page makes the visitor's browser send its cookie for you. See [endpoints](/reference/server#endpoints).
