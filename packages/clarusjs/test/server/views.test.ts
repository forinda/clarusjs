// #22: render(name, props) renders any view under src/ to HTML, from server code.
import { afterEach, expect, test } from 'vitest'
import { registerViews, render, viewName } from '../../src/server/views.ts'

afterEach(() => { delete (globalThis as { __clViews?: unknown }).__clViews })

test('view names are paths under src/ without the extension', () => {
  expect(viewName('/src/components/pill.tscl')).toBe('components/pill')
  expect(viewName('/src/pages/users/[id].tscl')).toBe('pages/users/[id]')
})

test('render() renders a registered view with its props', async () => {
  registerViews({ '/src/components/pill.tscl': async () => ({ render: (p: { text: string }) => `<b>${p.text}</b>` }) })
  expect(await render('components/pill', { text: 'new' })).toBe('<b>new</b>')
})

test('an unknown view is an error that lists what exists', async () => {
  registerViews({ '/src/components/pill.tscl': async () => ({ render: () => '' }) })
  await expect(render('components/pil' as 'components/pill', {})).rejects.toThrow('clarusjs: no view "components/pil"; views: components/pill')
})

test('without registered views (no server entry loaded) the error says so', async () => {
  await expect(render('x', {})).rejects.toThrow(/no views are registered/)
})
