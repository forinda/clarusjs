// Runs on the server for every request (this route is 'server' in vite.config.ts): it can read the request.
import { h, render } from 'clarusjs/views'
import { redirect, type LoadContext } from 'clarusjs/server'

export async function load({ request, cookies }: LoadContext) {
  const url = new URL(request.url)
  // A name of only spaces is no name: send the visitor to the plain page (a redirect, see the Routing guide).
  if (url.searchParams.has('name') && !(url.searchParams.get('name') ?? '').trim()) {
    cookies.delete('playground-name')
    return redirect('/playground', 303)
  }
  // A name given is remembered in a cookie (see cookies in the server reference); without one, the cookie's is used.
  const given = url.searchParams.get('name')?.slice(0, 60)
  if (given) cookies.set('playground-name', given, { maxAge: 60 * 60 * 24 * 30 })
  const name = given ?? cookies.get('playground-name')?.slice(0, 60) ?? ''
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
