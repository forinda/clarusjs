// #31: a page's .load.ts can export load({ params, request }); its result becomes the page's inputs.
import { expect, test, vi } from 'vitest'
import { createHandler } from '../../src/server/handler.ts'

const page = async () => ({ render: (p: Record<string, unknown> = {}) => `<p>${JSON.stringify(p)}</p>` })
const body = async (res: Response) => (await res.text()).replace(/^.*<body>|<\/body>.*$/g, '')

test('load() gets the params and the request, and its result is merged into the inputs', async () => {
  const seen: unknown[] = []
  const h = createHandler(
    { '/src/pages/users/[id].tscl': page, '/src/pages/about.tscl': page },
    { data: {
      '/src/pages/users/[id].load.ts': async () => ({
        load: async ({ params, request }: { params: Record<string, string>; request: Request }) => {
          seen.push([params, new URL(request.url).pathname])
          return { name: params.id!.toUpperCase(), count: 2 }
        },
      }),
    } },
  )
  expect(await body(await h.fetch(new Request('http://x/users/ada')))).toBe('<p>{"id":"ada","name":"ADA","count":2}</p>')
  expect(seen).toEqual([[{ id: 'ada' }, '/users/ada']])
  expect(await body(await h.fetch(new Request('http://x/about')))).toBe('<p>{}</p>') // no loader: just params
})

test('a load() that throws is a 500 that tells the visitor nothing; the log names the loader', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const h = createHandler(
    { '/src/pages/index.tscl': page },
    { data: { '/src/pages/index.load.ts': async () => ({ load: () => { throw new Error('db down') } }) } },
  )
  const res = await h.fetch(new Request('http://x/'))
  expect(res.status).toBe(500)
  expect(await res.text()).toBe('Internal Server Error')
  expect(log).toHaveBeenCalledWith('[clarusjs] src/pages/index.load.ts: load() failed: db down')
  log.mockRestore()
})

test('load() must return a plain object', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const h = createHandler(
    { '/src/pages/index.tscl': page },
    { data: { '/src/pages/index.load.ts': async () => ({ load: () => 'nope' as unknown as object }) } },
  )
  const res = await h.fetch(new Request('http://x/'))
  expect(res.status).toBe(500)
  expect(log).toHaveBeenCalledWith('[clarusjs] src/pages/index.load.ts: load() must return an object of page inputs, got string')
  log.mockRestore()
})
