import type { LoadContext } from 'clarusjs/server'

// Runs per request: reads the request, which a build-time render couldn't, and the user handle() resolved.
export function load({ request, cookies, locals }: LoadContext) {
  cookies.set('last-account', 'seen')
  return { agent: request.headers.get('user-agent') ?? 'none', user: locals.user ?? 'nobody' }
}
