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
  // id, aria-* and data-* written on its tag arrive with the props; class comes in the third argument.
  const html = await render({ name: 'Ada', id: 'welcome', 'data-test': 'greeting' }, undefined, { class: 'hero' })
  expect(html).toMatch(/<p [^>]*class="[^"]*\bhero\b/)
  expect(html).toContain('id="welcome"')
  expect(html).toContain('data-test="greeting"')
})
