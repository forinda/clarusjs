// The folder guard of /members (#457): every page under it is for signed-in visitors. Signed out, they're sent to the
// Auth guide's demo to sign in. It runs before each page's load(), so load() can count on locals.user.
import { redirect, type GuardContext } from 'clarusjs/server'

export function guard({ locals, url }: GuardContext) {
  if (!locals.user) return redirect('/guide/auth?next=' + encodeURIComponent(url.pathname) + '#islands-and-endpoints')
}
