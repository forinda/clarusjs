// The sidebar groups' icons: each name has path data, and component libraries get names for their usual groups.
import { expect, test } from 'vitest'
import { ICONS } from '../src/parts/icons.ts'

test('every group icon is SVG path data', () => {
  for (const [name, paths] of Object.entries(ICONS)) {
    expect(paths.length, name).toBeGreaterThan(0)
    for (const d of paths) expect(d, name).toMatch(/^[Mm][\d\s.,a-zA-Z-]+$/)
  }
})

test('names for a component library\'s groups: form, pointer, table, panel, overlay, menu, chart, message, image, grid', () => {
  for (const name of ['form', 'pointer', 'table', 'panel', 'overlay', 'menu', 'chart', 'message', 'image', 'grid']) expect(ICONS, name).toHaveProperty(name)
})
