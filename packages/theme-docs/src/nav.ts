// The theme's settings and the navigation helpers the layout uses. Server-only: the layout is static HTML. Lists are
// readonly, as a template's inputs are: the layout passes its config to these helpers as it gets it.

/** A sidebar entry; `order` sorts it within its group (lowest first, then by title). */
/**
 * A sidebar entry. `badge`: a short label beside it ("New"), also from a page's frontmatter. For a lesson (#371): `xp`,
 * what it can earn (from its steps and quizzes), and `minutes` (frontmatter), shown in the Learn path.
 */
export type Item = { title: string; href: string; order?: number; badge?: string; xp?: number; minutes?: number }
/** The icons a sidebar group can show (#369). */
export type GroupIcon = 'info' | 'code' | 'box' | 'shield' | 'download' | 'book' | 'terminal' | 'sparkles' | 'layers' | 'wrench' | 'rocket' | 'file'
/**
 * A sidebar group. `icon`: shown beside its title. `collapsed`: closed until opened (the group of the current page is
 * always open).
 */
export type Group = { title: string; icon?: GroupIcon; collapsed?: boolean; items: readonly Item[] }
/** A top-level part of the docs (Guide, Reference): its own sidebar groups. */
/** A top-level section. `switch: false` leaves it out of the phone drawer's switch (#370; link it with `menuLinks`). */
export type Section = { key: string; title: string; href: string; switch?: boolean; groups: readonly Group[] }
export type Social = { label: string; href: string; icon: 'github' | 'npm' | 'link' }
/** A heading on the page, for "On this page". */
export type Heading = { id: string; text: string; level: number }

/**
 * What a site's layout passes to a theme's `layout.tscl`: the contract a theme implements (#362). `config` and
 * `title` always; the rest optional, with the defaults the docs theme uses. A theme's layout also has the slots
 * `sidebar-top`, `sidebar-bottom`, `content-top`, `content-bottom` and `footer`, beside its default one.
 * @see https://clarusjs.com/guide/writing-a-theme
 */
export type LayoutInputs = {
  config: ThemeConfig
  title: string
  description?: string
  /** The page's sidebar entry (default '/'). */
  path?: string
  /** The page's own route, when it differs from its sidebar entry. */
  source?: string
  /** The page's own address, when path names its sidebar entry instead. */
  url?: string
  /** The page's h2 and h3, for "On this page". */
  headings?: Heading[]
  /** A tool rather than a page: no sidebar, crumb or footers. */
  app?: boolean
}

export type ThemeConfig = {
  /** The site's name in the header: `{ text: 'clarus', accent: '.js' }` shows the accent in the brand colour. */
  brand: { text: string; accent?: string; logo?: string }
  /** The site's public address, for structured data (no trailing slash). */
  siteUrl?: string
  sections: readonly Section[]
  /** Icon links at the right of the header (GitHub, npm…). */
  social?: readonly Social[]
  /** Text links at the bottom of the phone drawer, before the social links (Reference, Releases…) (#370). */
  menuLinks?: readonly { label: string; href: string }[]
  /**
   * "Edit this page": a pattern where `:file` is the page's source file under src/pages (`guide/start.md`, found in
   * `pages`), or a function of the route (the page's source route, for dynamic pages). None without it.
   */
  editLink?: string | ((path: string) => string)
  /** The pages as themeDocs() reads them: source files for `editLink` patterns, and "Last updated" dates. */
  pages?: readonly PageInfo[]
  /**
   * Learn: the section whose pages are lessons, and its progress page (not a lesson). Progress, XP and badges are
   * kept in the browser (localStorage); an XP chip shows in lesson headers and on the section's pages.
   */
  learn?: { section: string; progress: string }
  /** A search button (and Ctrl/⌘K, /) in the header; the index comes from the themeDocs() Vite plugin. */
  search?: boolean
  /**
   * Page changes animate as view transitions where the browser has them (a cross-fade; `::view-transition-*` rules in
   * the site's CSS change it). Needs fragment navigation or client routes; no animation with reduced motion.
   */
  viewTransitions?: boolean
  /** The site footer's text. */
  footer?: string
}

const none: Item = { title: '', href: '' }
const flat = (section: Section) => section.groups.flatMap((g) => g.items)

/** The section a page belongs to ('' for pages outside every section, like a home page). */
export function sectionKey(sections: readonly Section[], path: string): string {
  return sections.find((s) => flat(s).some((i) => i.href === path))?.key ?? ''
}

/** Sidebar groups for the page's section (none outside the sections). */
export function groupsOf(sections: readonly Section[], path: string): readonly Group[] {
  return sections.find((s) => s.key === sectionKey(sections, path))?.groups ?? []
}

/** "Guide › Templates" */
export function crumb(sections: readonly Section[], path: string): string {
  const section = sections.find((s) => s.key === sectionKey(sections, path))
  const group = section?.groups.find((g) => g.items.some((i) => i.href === path))
  return section && group ? `${section.title} › ${group.title}` : ''
}

/** Previous and next pages in sidebar order; an empty item (href '') when there is none. */
export function pager(sections: readonly Section[], path: string): { prev: Item; next: Item } {
  const section = sections.find((s) => s.key === sectionKey(sections, path))
  const items = section ? flat(section) : []
  const i = items.findIndex((item) => item.href === path)
  return { prev: items[i - 1] ?? none, next: items[i + 1] ?? none }
}

/**
 * A page as `themeDocs()` reads it (`import pages from 'virtual:theme-docs/pages'`): its route, source file under
 * src/pages, last commit time (unix seconds), sidebar entry, and `hidden` when it isn't in the sidebar.
 */
export type PageInfo = { href: string; title: string; file: string; group?: string; order?: number; badge?: string; xp?: number; minutes?: number; updated?: number; hidden?: boolean }

/**
 * The sections with their sidebar filled from the pages under `/<section key>/`: a page sits in its `group` (else the
 * section's title), sorted by `order`, then title. The config wins: its groups come first and its items replace pages
 * with the same href, so it can rename, reorder and add (non-page) entries. An empty section `href` means its first page.
 */
export function pagesNav(sections: readonly Section[], pages: readonly PageInfo[]): Section[] {
  return sections.map((section) => {
    const groups: { title: string; icon?: GroupIcon; collapsed?: boolean; items: Item[] }[] = section.groups.map((g) => ({ ...g, items: [...g.items] }))
    const listed = new Set(groups.flatMap((g) => g.items.map((i) => i.href)))
    for (const page of pages) {
      const inSection = page.href === `/${section.key}` || page.href.startsWith(`/${section.key}/`)
      if (page.hidden || !inSection || listed.has(page.href)) continue
      const title = page.group ?? section.title
      let group = groups.find((g) => g.title === title)
      if (!group) groups.push(group = { title, items: [] })
      const item: Item = { title: page.title, href: page.href }
      if (page.order !== undefined) item.order = page.order
      if (page.badge) item.badge = page.badge
      if (page.xp) item.xp = page.xp
      if (page.minutes) item.minutes = page.minutes
      group.items.push(item)
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
