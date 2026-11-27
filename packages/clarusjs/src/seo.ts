// Structured data (#606): schema.org objects as JSON-LD, typed, for a page's
// <script type="application/ld+json">{{ article({ … }) }}</script> or the plugin's head.jsonLd. Plain functions
// returning plain objects: nothing reaches the browser unless a page writes it.

type Thing<T extends string> = { '@context': 'https://schema.org'; '@type': T }
/**
 * A person, by name or with a link.
 * @see https://clarusjs.com/guide/seo#structured-data
 */
export type PersonInput = string | { name: string; url?: string }

const thing = <T extends string>(type: T): Thing<T> => ({ '@context': 'https://schema.org', '@type': type })
const absolute = (where: string, url: string): string => {
  if (!/^https?:\/\//.test(url)) throw new Error(`clarusjs/seo: ${where} "${url}" is relative: JSON-LD needs absolute URLs (https://…)`)
  return url
}
const urls = (where: string, value: string | string[]): string | string[] => (Array.isArray(value) ? value.map((u, i) => absolute(`${where}[${i}]`, u)) : absolute(where, value))
const date = (where: string, value: string | Date): string => {
  if (value instanceof Date) return value.toISOString()
  if (Number.isNaN(Date.parse(value))) throw new Error(`clarusjs/seo: ${where} "${value}" is not a date`)
  return value
}
const person = (where: string, p: PersonInput) => (typeof p === 'string' ? { '@type': 'Person', name: p } : { '@type': 'Person', name: p.name, ...(p.url ? { url: absolute(`${where}.url`, p.url) } : {}) })
// Only the fields given: undefined ones are left out of the JSON.
const defined = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

/**
 * An article or blog post. People may be names; dates may be Date objects (written as ISO strings).
 * @example
 * <script type="application/ld+json">{{ article({ headline: title, datePublished: date, author: 'Ada' }) }}</script>
 * @see https://clarusjs.com/guide/seo#structured-data
 */
export function article(a: { headline: string; datePublished: string | Date; dateModified?: string | Date; author?: PersonInput | PersonInput[]; image?: string | string[]; description?: string; url?: string }) {
  return defined({
    ...thing('Article'),
    headline: a.headline,
    datePublished: date('article.datePublished', a.datePublished),
    dateModified: a.dateModified === undefined ? undefined : date('article.dateModified', a.dateModified),
    author: a.author === undefined ? undefined : Array.isArray(a.author) ? a.author.map((p, i) => person(`article.author[${i}]`, p)) : person('article.author', a.author),
    image: a.image === undefined ? undefined : urls('article.image', a.image),
    description: a.description,
    url: a.url === undefined ? undefined : absolute('article.url', a.url),
  })
}

/**
 * The trail to a page, outermost first: each step's name and absolute URL.
 * @example
 * <script type="application/ld+json">{{ breadcrumbs([{ name: 'Docs', url: 'https://example.com/docs' }]) }}</script>
 * @see https://clarusjs.com/guide/seo#structured-data
 */
export function breadcrumbs(steps: { name: string; url: string }[]) {
  return {
    ...thing('BreadcrumbList'),
    itemListElement: steps.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.name, item: absolute(`breadcrumbs[${i}].url`, s.url) })),
  }
}

/**
 * A product, with an offer (price, currency, availability) and a rating.
 * @example
 * <script type="application/ld+json">{{ product({ name, offers: { price: 49.5, currency: 'EUR', availability: 'InStock' } }) }}</script>
 * @see https://clarusjs.com/guide/seo#structured-data
 */
export function product(p: {
  name: string
  description?: string
  image?: string | string[]
  sku?: string
  brand?: string
  offers?: { price: number | string; currency: string; availability?: 'InStock' | 'OutOfStock' | 'PreOrder' | 'BackOrder' | 'Discontinued'; url?: string }
  rating?: { value: number; count: number }
}) {
  return defined({
    ...thing('Product'),
    name: p.name,
    description: p.description,
    image: p.image === undefined ? undefined : urls('product.image', p.image),
    sku: p.sku,
    brand: p.brand === undefined ? undefined : { '@type': 'Brand', name: p.brand },
    offers: p.offers === undefined ? undefined : defined({
      '@type': 'Offer',
      price: p.offers.price,
      priceCurrency: p.offers.currency,
      availability: p.offers.availability === undefined ? undefined : `https://schema.org/${p.offers.availability}`,
      url: p.offers.url === undefined ? undefined : absolute('product.offers.url', p.offers.url),
    }),
    aggregateRating: p.rating === undefined ? undefined : { '@type': 'AggregateRating', ratingValue: p.rating.value, reviewCount: p.rating.count },
  })
}

/**
 * The organization behind a site: its name, address, logo and profiles elsewhere (`sameAs`).
 * @example
 * clarusjs({ head: { jsonLd: organization({ name: 'Acme', url: 'https://acme.example' }) } })
 * @see https://clarusjs.com/guide/seo#structured-data
 */
export function organization(o: { name: string; url: string; logo?: string; sameAs?: string[] }) {
  return defined({
    ...thing('Organization'),
    name: o.name,
    url: absolute('organization.url', o.url),
    logo: o.logo === undefined ? undefined : absolute('organization.logo', o.logo),
    sameAs: o.sameAs === undefined ? undefined : o.sameAs.map((u, i) => absolute(`organization.sameAs[${i}]`, u)),
  })
}

/**
 * The site itself: its name and address (search engines show the name).
 * @example
 * clarusjs({ head: { jsonLd: website({ name: 'Acme docs', url: 'https://acme.example/docs/' }) } })
 * @see https://clarusjs.com/guide/seo#structured-data
 */
export function website(w: { name: string; url: string }) {
  return { ...thing('WebSite'), name: w.name, url: absolute('website.url', w.url) }
}
