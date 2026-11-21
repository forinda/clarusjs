// The lesson helpers in nav.ts.
import { expect, test } from 'vitest'
import { lessonOf, type Section, type ThemeConfig } from '../src/nav.ts'

test("#168: leave goes to the section's own page, or home when the section's link is one of its lessons", () => {
  const lessons = [{ title: 'A', href: '/learn/a' }, { title: 'B', href: '/learn/b' }]
  const section = (href: string): ThemeConfig => ({ brand: { text: 'x' }, sections: [{ key: 'tour', title: 'Learn', href, groups: [{ title: 'G', items: lessons }] }] satisfies Section[] })
  expect(lessonOf(section('/learn'), '/learn/b')).toMatchObject({ leave: '/learn', prev: '/learn/a', next: '', label: 'Learn · Lesson 2 of 2' })
  expect(lessonOf(section('/learn/a'), '/learn/b').leave).toBe('/')
  expect(lessonOf(section('/learn/a'), '/learn/a').leave).toBe('/')
  // A Learn section (config.learn) leads to its progress page.
  expect(lessonOf({ ...section('/learn/a'), learn: { section: 'tour', progress: '/learn/progress' } }, '/learn/a').leave).toBe('/learn/progress')
})
