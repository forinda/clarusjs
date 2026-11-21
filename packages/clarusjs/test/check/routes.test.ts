// #184: typed routes: clarusjs check writes .clarusjs/routes.d.ts; href() builds a route's URL from its params.
import { expect, test } from 'vitest'
import { routesDeclaration } from '../../src/check/generate.ts'
import { href } from '../../src/runtime/navigation.ts'

test('routesDeclaration: every page under src/pages (any page source), its [params]; scripts, styles, data and _files are not pages', () => {
  const out = routesDeclaration([
    'src/pages/index.tscl', 'src/pages/guide/holes.md', 'src/pages/releases/[version].tscl', 'src/pages/releases/[version].load.ts',
    'src/pages/users/[org]/[id].tscl', 'src/pages/playground.load.ts', 'src/pages/_partial.md', 'src/pages/data.json', 'src/pages/site.css', 'src/pages/guide/index.md',
  ])
  expect(out).toContain("declare module 'clarusjs/navigation' {")
  expect(out).toContain('    "/": {}')
  expect(out).toContain('    "/guide": {}')
  expect(out).toContain('    "/guide/holes": {}')
  expect(out).toContain('    "/releases/[version]": { version: string }')
  expect(out).toContain('    "/users/[org]/[id]": { org: string; id: string }')
  expect(out).not.toMatch(/load|_partial|data|site/)
})

test('href(): the route with its params put in (encoded), under the site base', () => {
  // This package has no generated routes: any path, params optional.
  expect(href('/releases/[version]', { version: '0.8.0' })).toBe('/releases/0.8.0')
  expect(href('/users/[org]/[id]', { org: 'a b', id: 'x/y' })).toBe('/users/a%20b/x%2Fy')
  expect(href('/guide/holes')).toBe('/guide/holes')
})
