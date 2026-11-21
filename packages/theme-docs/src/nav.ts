// The theme's settings and the navigation helpers the layout uses. Server-only: the layout is static HTML.

/** A sidebar entry; `order` sorts it within its group (lowest first, then by title). */
export type Item = { title: string; href: string; order?: number }
export type Group = { title: string; items: Item[] }
/** A top-level part of the docs (Guide, Reference): its own sidebar groups. */
export type Section = { key: string; title: string; href: string; groups: Group[] }
export type Social = { label: string; href: string; icon: 'github' | 'npm' | 'link' }
/** A heading on the page, for "On this page". */
export type Heading = { id: string; text: string; level: number }

export type ThemeConfig = {
  /** The site's name in the header: `{ text: 'clarus', accent: '.js' }` shows the accent in the brand colour. */
  brand: { text: string; accent?: string; logo?: string }
  /** The site's public address, for structured data (no trailing slash). */
  siteUrl?: string
  sections: Section[]
  /** Icon links at the right of the header (GitHub, npm…). */
  social?: Social[]
  /**
   * "Edit this page": a pattern where `:file` is the page's source file under src/pages (`guide/start.md`, found in
   * `pages`), or a function of the route (the page's source route, for dynamic pages). None without it.
   */
  editLink?: string | ((path: string) => string)
  /** The pages as themeDocs() reads them: source files for `editLink` patterns, and "Last updated" dates. */
  pages?: PageInfo[]
  /**
   * Learn: the section whose pages are lessons, and its progress page (not a lesson). Progress, XP and badges are
   * kept in the browser (localStorage); an XP chip shows in lesson headers and on the section's pages.
   */
  learn?: { section: string; progress: string }
  /** A search button (and Ctrl/⌘K, /) in the header; the index comes from the themeDocs() Vite plugin. */
  search?: boolean
  /** The site footer's text. */
  footer?: string
}

const none: Item = { title: '', href: '' }
const flat = (section: Section) => section.groups.flatMap((g) => g.items)

/** The section a page belongs to ('' for pages outside every section, like a home page). */
export function sectionKey(sections: Section[], path: string): string {
  return sections.find((s) => flat(s).some((i) => i.href === path))?.key ?? ''
}

/** Sidebar groups for the page's section (none outside the sections). */
export function groupsOf(sections: Section[], path: string): Group[] {
  return sections.find((s) => s.key === sectionKey(sections, path))?.groups ?? []
}

/** "Guide › Templates" */
export function crumb(sections: Section[], path: string): string {
  const section = sections.find((s) => s.key === sectionKey(sections, path))
  const group = section?.groups.find((g) => g.items.some((i) => i.href === path))
  return section && group ? `${section.title} › ${group.title}` : ''
}

/** Previous and next pages in sidebar order; an empty item (href '') when there is none. */
export function pager(sections: Section[], path: string): { prev: Item; next: Item } {
  const section = sections.find((s) => s.key === sectionKey(sections, path))
  const items = section ? flat(section) : []
  const i = items.findIndex((item) => item.href === path)
  return { prev: items[i - 1] ?? none, next: items[i + 1] ?? none }
}

/**
 * A page as `themeDocs()` reads it (`import pages from 'virtual:theme-docs/pages'`): its route, source file under
 * src/pages, last commit time (unix seconds), sidebar entry, and `hidden` when it isn't in the sidebar.
 */
export type PageInfo = { href: string; title: string; file: string; group?: string; order?: number; updated?: number; hidden?: boolean }

/**
 * The sections with their sidebar filled from the pages under `/<section key>/`: a page sits in its `group` (else the
 * section's title), sorted by `order`, then title. The config wins: its groups come first and its items replace pages
 * with the same href, so it can rename, reorder and add (non-page) entries. An empty section `href` means its first page.
 */
export function pagesNav(sections: Section[], pages: PageInfo[]): Section[] {
  return sections.map((section) => {
    const groups = section.groups.map((g) => ({ title: g.title, items: [...g.items] }))
    const listed = new Set(groups.flatMap((g) => g.items.map((i) => i.href)))
    for (const page of pages) {
      const inSection = page.href === `/${section.key}` || page.href.startsWith(`/${section.key}/`)
      if (page.hidden || !inSection || listed.has(page.href)) continue
      const title = page.group ?? section.title
      let group = groups.find((g) => g.title === title)
      if (!group) groups.push(group = { title, items: [] })
      group.items.push(page.order === undefined ? { title: page.title, href: page.href } : { title: page.title, href: page.href, order: page.order })
    }
    const rank = (i: Item) => i.order ?? Infinity
    for (const g of groups) g.items.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title))
    // New groups (after the config's) in the order of their first item.
    const added = groups.slice(section.groups.length).sort((a, b) => rank(a.items[0]!) - rank(b.items[0]!))
    const all = [...groups.slice(0, section.groups.length), ...added]
    return { ...section, href: section.href || all.find((g) => g.items.length)?.items[0]?.href || '', groups: all }
  })
}

/** "Edit this page" for a route (its source route, for dynamic pages): '' when there is none. */
export function editHref(config: ThemeConfig, route: string): string {
  if (typeof config.editLink === 'function') return config.editLink(route)
  const file = config.pages?.find((p) => p.href === route)?.file
  return config.editLink && file ? config.editLink.replace(':file', file) : ''
}

/** When the page last changed (its source route, for dynamic pages): `{ iso, text }`, or undefined without a date. */
export function updatedOf(config: ThemeConfig, route: string): { iso: string; text: string } | undefined {
  const seconds = config.pages?.find((p) => p.href === route)?.updated
  if (seconds === undefined) return undefined
  const date = new Date(seconds * 1000)
  return { iso: date.toISOString(), text: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) }
}

/** The lessons of the Learn section, in order (its items but the progress page). */
export function lessonsOf(config: ThemeConfig): Item[] {
  const section = config.sections.find((s) => s.key === config.learn?.section)
  return section ? flat(section).filter((i) => i.href !== config.learn?.progress) : []
}

/**
 * A lesson's place in its section (the config section that lists it; with `learn`, its lessons): where "leave" goes
 * (the section's href), the previous and next lessons, and "Learn · Lesson 2 of 6". total 0 outside every section.
 */
export function lessonOf(config: ThemeConfig, path: string): { leave: string; prev: string; next: string; label: string; total: number } {
  const section = config.sections.find((s) => s.key === sectionKey(config.sections, path))
  const items = section ? (section.key === config.learn?.section ? lessonsOf(config) : flat(section)) : []
  const i = items.findIndex((item) => item.href === path)
  return {
    // Learn lessons lead back to the progress page; other lessons to their section's own page, unless that is one
    // of its lessons (leaving would open a lesson): then home.
    leave: section && section.key === config.learn?.section ? config.learn.progress || '/'
      : section?.href && !items.some((item) => item.href === section.href) ? section.href : '/',
    prev: items[i - 1]?.href ?? '',
    next: items[i + 1]?.href ?? '',
    label: section ? `${section.title} · Lesson ${i + 1} of ${items.length}` : '',
    total: items.length,
  }
}
