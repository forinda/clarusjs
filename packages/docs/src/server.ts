// handle(): runs once per request on the server, before any page or endpoint (see the Auth and cookies guide). It
// turns the demo's session cookie into locals.user, so loaders and endpoints never read cookies themselves.
import type { Handle } from 'clarusjs/server'

declare module 'clarusjs/server' {
  interface Locals {
    /** The demo's signed-in visitor (a name in a cookie: a demo, not real authentication). */
    user?: { name: string }
  }
}

export const handle: Handle = ({ cookies, locals }) => {
  const name = cookies.get('demo-user')
  if (name) locals.user = { name }
}
