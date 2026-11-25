import type { GroupIcon, Section } from '@clarusjs/theme-docs/nav.ts'
import { COMPONENT_GROUPS } from './registry.ts'

const GROUP_ICONS = {
  Form: 'form',
  Button: 'pointer',
  Data: 'table',
  Panel: 'panel',
  Overlay: 'overlay',
  Menu: 'menu',
  Chart: 'chart',
  Messages: 'message',
  Media: 'image',
  Misc: 'grid',
} as const satisfies Record<(typeof COMPONENT_GROUPS)[number], GroupIcon>

// The sidebar's skeleton and the header's links (one per section): component pages (src/pages/components/,
// frontmatter `group`, one of COMPONENT_GROUPS in this order, and `order`) and block pages (src/pages/blocks/) fill it.
export const sidebar: Section[] = [
  {
    key: 'components',
    title: 'Components',
    href: '/components',
    groups: [{ title: 'Get started', icon: 'rocket', items: [{ title: 'Introduction', href: '/components', order: 1 }] }, ...COMPONENT_GROUPS.map((title) => ({ title, icon: GROUP_ICONS[title], items: [] }))],
  },
  { key: 'blocks', title: 'Blocks', href: '/blocks', groups: [{ title: 'Blocks', icon: 'layers', items: [] }] },
]
