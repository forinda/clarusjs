// #606: clarusjs/seo builds schema.org structured data (JSON-LD), typed, for a page's
// <script type="application/ld+json">{{ … }}</script> or the plugin's head.jsonLd.
import { expect, test } from 'vitest'
import { article, breadcrumbs, organization, product, website } from '../src/seo.ts'

const context = 'https://schema.org'

test('article: people from names, dates as ISO strings', () => {
  expect(article({
    headline: 'Islands, explained',
    datePublished: new Date('2026-11-20T09:00:00Z'),
    dateModified: '2026-11-21',
    author: ['Ada', { name: 'Grace', url: 'https://example.com/grace' }],
    image: 'https://example.com/og.png',
    url: 'https://example.com/blog/islands',
  })).toEqual({
    '@context': context,
    '@type': 'Article',
    headline: 'Islands, explained',
    datePublished: '2026-11-20T09:00:00.000Z',
    dateModified: '2026-11-21',
    author: [{ '@type': 'Person', name: 'Ada' }, { '@type': 'Person', name: 'Grace', url: 'https://example.com/grace' }],
    image: 'https://example.com/og.png',
    url: 'https://example.com/blog/islands',
  })
})

test('breadcrumbs: a list item per step, numbered from 1', () => {
  expect(breadcrumbs([{ name: 'Docs', url: 'https://example.com/docs' }, { name: 'Deploying', url: 'https://example.com/docs/deploy' }])).toEqual({
    '@context': context,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Docs', item: 'https://example.com/docs' },
      { '@type': 'ListItem', position: 2, name: 'Deploying', item: 'https://example.com/docs/deploy' },
    ],
  })
})

test('product: an offer with its availability as a schema.org URL, a brand and a rating', () => {
  expect(product({
    name: 'Desk lamp',
    image: ['https://example.com/lamp.jpg'],
    sku: 'L-1',
    brand: 'Lumen',
    offers: { price: 49.5, currency: 'EUR', availability: 'InStock' },
    rating: { value: 4.6, count: 128 },
  })).toEqual({
    '@context': context,
    '@type': 'Product',
    name: 'Desk lamp',
    image: ['https://example.com/lamp.jpg'],
    sku: 'L-1',
    brand: { '@type': 'Brand', name: 'Lumen' },
    offers: { '@type': 'Offer', price: 49.5, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
    aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.6, reviewCount: 128 },
  })
})

test('organization and website', () => {
  expect(organization({ name: 'Acme', url: 'https://acme.example', logo: 'https://acme.example/logo.png', sameAs: ['https://github.com/acme'] })).toEqual({
    '@context': context, '@type': 'Organization', name: 'Acme', url: 'https://acme.example', logo: 'https://acme.example/logo.png', sameAs: ['https://github.com/acme'],
  })
  expect(website({ name: 'Acme docs', url: 'https://acme.example/docs/' })).toEqual({ '@context': context, '@type': 'WebSite', name: 'Acme docs', url: 'https://acme.example/docs/' })
})

test('a relative URL is an error naming the field: search engines read absolute ones only', () => {
  expect(() => breadcrumbs([{ name: 'Docs', url: '/docs' }])).toThrow('clarusjs/seo: breadcrumbs[0].url "/docs" is relative: JSON-LD needs absolute URLs (https://…)')
  expect(() => article({ headline: 'x', datePublished: '2026-01-01', image: 'og.png' })).toThrow('clarusjs/seo: article.image "og.png" is relative')
  expect(() => article({ headline: 'x', datePublished: 'yesterday' })).toThrow('clarusjs/seo: article.datePublished "yesterday" is not a date')
})

test('in a page: the JSON-LD script holds the builder\'s object, written safely inside the script', async () => {
  const { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { resolve } = await import('node:path')
  const { createBuilder } = await import('vite')
  const { default: clarusjs } = await import('../src/vite/plugin.ts')
  const root = mkdtempSync(resolve(tmpdir(), 'clarus-seo-'))
  mkdirSync(resolve(root, 'src/pages'), { recursive: true })
  writeFileSync(resolve(root, 'src/pages/index.tscl'), `@import { article } from 'clarusjs/seo'
<script server>
  const title = 'Closing <' + '/script> tags'
</script>
<script type="application/ld+json">{{ article({ headline: title, datePublished: '2026-11-27', author: 'Ada' }) }}</script>
<h1>{{ title }}</h1>
`)
  mkdirSync(resolve(root, 'node_modules'))
  symlinkSync(resolve(import.meta.dirname, '..'), resolve(root, 'node_modules/clarusjs'), 'junction')
  await (await createBuilder({ root, configFile: false, logLevel: 'silent', plugins: [clarusjs()] })).buildApp()
  const html = readFileSync(resolve(root, 'dist/client/index.html'), 'utf8')
  const data = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)![1]!
  expect(data).not.toContain('</script')
  expect(JSON.parse(data)).toEqual({ '@context': 'https://schema.org', '@type': 'Article', headline: 'Closing </script> tags', datePublished: '2026-11-27', author: { '@type': 'Person', name: 'Ada' } })
}, 120_000)
