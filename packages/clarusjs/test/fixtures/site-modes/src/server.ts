// handle() (#93): once per request, before any page loads. Resolves a "session" cookie into locals.user.
import type { Handle } from 'clarusjs/server'

declare module 'clarusjs/server' {
  interface Locals { user?: string }
}

export const handle: Handle = ({ cookies, locals }) => {
  const session = cookies.get('session')
  if (session) locals.user = `user ${session}`
}
