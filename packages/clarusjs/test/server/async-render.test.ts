// #430: a page whose render is async (a <script server> that awaits) is awaited by the handler; component loaders'
// data stays with its own request even when renders pause at an await and overlap.
import { expect, test } from 'vitest'
import { createHandler } from '../../src/server/handler.ts'
import { loaded } from '../../src/runtime/server.ts'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('an async render is awaited: the page is served with what it awaited', async () => {
  const h = createHandler({ '/src/pages/index.tscl': async () => ({ render: async () => { await wait(5); return '<main>awaited</main>' } }) }, { dev: true, modes: { '/': 'server' } })
  const html = await (await h.fetch(new Request('https://x.test/'))).text()
  expect(html).toContain('<main>awaited</main>')
})

test('overlapping async renders each read their own component loader data, after their await', async () => {
  // The page awaits (a different time per request), then renders a component that reads its loader's data.
  const page = { render: async (props: { who: string }) => { await wait(props.who === 'ada' ? 40 : 5); return `<b>${(loaded('src/components/who.tscl') as { who?: string }).who}</b>` } }
  const h = createHandler(
    { '/src/pages/[who].tscl': async () => page },
    {
      dev: true,
      modes: { '/[who]': 'server' },
      componentLoaders: { '/[who]': ['/src/components/who.load.ts'] },
      componentData: { '/src/components/who.load.ts': async () => ({ load: (({ params }: { params: { who: string } }) => ({ who: params.who })) as never }) },
    },
  )
  const [ada, alan] = await Promise.all(['ada', 'alan'].map(async (who) => (await h.fetch(new Request(`https://x.test/${who}`))).text()))
  expect(ada).toContain('<b>ada</b>')
  expect(alan).toContain('<b>alan</b>')
})
