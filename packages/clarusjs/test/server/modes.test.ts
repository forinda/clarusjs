// #29: per-route rendering modes.
import { expect, test } from 'vitest'
import { checkModes, modeFor } from '../../src/server/modes.ts'
import { createHandler } from '../../src/server/handler.ts'

test('the most specific pattern wins; routes default to static', () => {
  const table = { '/account/*': 'server', '/account/help': 'static', '/*': 'static' } as const
  expect(modeFor('/account/[id]', table)).toBe('server')
  expect(modeFor('/account', table)).toBe('server')
  expect(modeFor('/account/help', table)).toBe('static')
  expect(modeFor('/accounts', table)).toBe('static') // '/account/*' is a folder, not a prefix of the name
  expect(modeFor('/', {})).toBe('static')
})

test('the mode table is checked: known modes and absolute patterns only', () => {
  expect(() => checkModes({ '/a/*': 'server', '/b': 'static' })).not.toThrow()
  expect(() => checkModes({ '/a': 'ssr' })).toThrow(`clarusjs: routes['/a'] is "ssr"; use 'static' or 'server'`)
  expect(() => checkModes({ 'a/*': 'server' })).toThrow(`clarusjs: route pattern "a/*" must start with /`)
  expect(() => checkModes({ '/a/*/b': 'server' })).toThrow(`clarusjs: route pattern "/a/*/b" may only use * as its last segment`)
  expect(() => checkModes({ '/app/*': 'client' })).toThrow(`clarusjs: routes['/app/*'] is "client", which isn't available yet; use 'static' or 'server'`)
})

test('server routes are left out of prerendering, even dynamic ones without entries()', async () => {
  const page = async () => ({ render: () => '<p>x</p>' })
  const h = createHandler(
    { '/src/pages/index.tscl': page, '/src/pages/account/[id].tscl': page, '/src/pages/account/index.tscl': page },
    { modes: { '/account/*': 'server' } },
  )
  expect(await h.paths()).toEqual(['/'])
  expect(h.serverRoutes).toEqual(['/account', '/account/[id]'])
  expect((await h.fetch(new Request('http://x/account/7'))).status).toBe(200) // still rendered on request
})

test('isServerPath() tells a host which URLs belong to server routes', () => {
  const page = async () => ({ render: () => '' })
  const h = createHandler({ '/src/pages/blog/[slug].tscl': page, '/src/pages/account/[id].tscl': page }, { modes: { '/account/*': 'server' } })
  expect(h.isServerPath('/account/7')).toBe(true)
  expect(h.isServerPath('/account/7/')).toBe(true)
  expect(h.isServerPath('/blog/hello')).toBe(false)
  expect(h.isServerPath('/nope')).toBe(false)
})
