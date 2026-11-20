// Runs on the server for every request (this route is 'server' in vite.config.ts): it can read the request.
import { render } from 'clarusjs/views'

export async function load({ request }: { request: Request }) {
  const url = new URL(request.url)
  const name = (url.searchParams.get('name') ?? '').slice(0, 60)
  return {
    name,
    renderedAt: new Date().toISOString(),
    agent: request.headers.get('user-agent') ?? 'unknown',
    // Any view can be rendered to HTML by name, typed against its inputs (see .clarusjs/views.d.ts).
    pillHtml: await render('components/pill', { text: name || 'guest' }),
  }
}
