// Runs per request: reads the request, which a build-time render couldn't.
export function load({ request }: { request: Request }) {
  return { agent: request.headers.get('user-agent') ?? 'none' }
}
