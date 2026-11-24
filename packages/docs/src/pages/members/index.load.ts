// Runs after ./+guard.ts, which already sent signed-out visitors away.
import type { LoadContext } from 'clarusjs/server'

export function load({ locals }: LoadContext) {
  return { name: locals.user!.name }
}
