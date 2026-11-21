// The theme's settings and the navigation helpers the layout uses. Server-only: the layout is static HTML.

export type Item = { title: string; href: string }
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
