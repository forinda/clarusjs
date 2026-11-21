// Runs on the server for every request (this route is 'server' in vite.config.ts): it can read the request.
import { h, render } from 'clarusjs/views'
import { redirect } from 'clarusjs/server'

export async function load({ request }: { request: Request }) {
  const url = new URL(request.url)
  const name = (url.searchParams.get('name') ?? '').slice(0, 60)
  // A name of only spaces is no name: send the visitor to the plain page (a redirect, see the Routing guide).
  if (url.searchParams.has('name') && !name.trim()) return redirect('/playground', 303)
  return {
    name,
    renderedAt: new Date().toISOString(),
    agent: request.headers.get('user-agent') ?? 'unknown',
    // Any view can be rendered to HTML by name, typed against its inputs (see .clarusjs/views.d.ts).
    pillHtml: await render('components/pill', { text: name || 'guest' }),
    // Built with h(): an element and a view, nested. The page's {{ }} inserts it as HTML; the name in it stays text.
    built: await h('p', { class: 'built' }, [h('components/pill', { text: name || 'guest' }), ' ', h('em', {}, ['built with h()'])]),
  }
}
