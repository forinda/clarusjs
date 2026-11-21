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
  /** "Edit this page" for a route (and the page's source route, for dynamic pages); none without it. */
  editLink?: (path: string) => string
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

/** A page as `themeDocs()` reads it (`import pages from 'virtual:theme-docs/pages'`). */
export type PageInfo = { href: string; title: string; group?: string; order?: number }

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
      if (!page.href.startsWith(`/${section.key}/`) || listed.has(page.href)) continue
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
    return { ...section, href: section.href || all[0]?.items[0]?.href || '', groups: all }
  })
}
