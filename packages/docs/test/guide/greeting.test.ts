// The testing guide's example (/guide/testing): import a component and check what it renders.
import { expect, test } from 'vitest'
import { render } from './greeting.tscl'

test('renders its input', async () => {
  const html = await render({ name: 'Ada' })
  expect(html).toContain('Hello, Ada')
  expect(html).toContain('data-tone="plain"')
})

test('escapes what it renders', async () => {
  const html = await render({ name: '<b>x</b>' })
  expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
  expect(html).not.toContain('<b>x</b>')
})

test('puts slot content at <slot />', async () => {
  expect(await render({ name: 'Ada' }, { default: '!' })).toContain('Hello, Ada!')
})

test('takes attributes written on its tag', async () => {
  // A parent's tag passes class (and id, style, aria-*, data-*) as the third argument.
  const html = await render({ name: 'Ada' }, undefined, { class: 'hero' })
  expect(html).toMatch(/<p [^>]*class="[^"]*\bhero\b/)
})
