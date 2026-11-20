// Runs on the server for every request (this route is 'server' in vite.config.ts): it can read the request.
export function load({ request }: { request: Request }) {
  const url = new URL(request.url)
  return {
    name: (url.searchParams.get('name') ?? '').slice(0, 60),
    renderedAt: new Date().toISOString(),
    agent: request.headers.get('user-agent') ?? 'unknown',
  }
}
