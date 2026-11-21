// #159: learning progress in one versioned localStorage key; XP and badges computed from it.
import { expect, test } from 'vitest'
import { answer, empty, finish, load, reset, save, stats, step, type Progress } from '../src/progress.ts'

const memory = () => {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), data }
}
const lessons = ['/learn/a', '/learn/b', '/learn/c', '/learn/d']

test('steps, finished lessons and first answers are recorded once', () => {
  let p: Progress = empty()
  p = step(p, '/learn/a', 'read')
  p = step(p, '/learn/a', 'read')
  p = step(p, '/learn/a', 'write')
  p = finish(p, '/learn/a')
  p = finish(p, '/learn/a')
  p = answer(p, '/learn/a#quiz-0', false)
  p = answer(p, '/learn/a#quiz-0', true) // only the first answer counts
  expect(p).toEqual({ v: 1, steps: { '/learn/a': ['read', 'write'] }, done: ['/learn/a'], quizzes: { '/learn/a#quiz-0': false } })
})

test('XP: 10 a step, 50 a lesson, 20 a quiz right first time; accuracy; badges', () => {
  let p = empty()
  for (const l of lessons.slice(0, 2)) p = finish(step(step(p, l, 'read'), l, 'write'), l)
  for (let i = 0; i < 5; i++) p = answer(p, `/learn/a#quiz-${i}`, true)
  p = answer(p, '/learn/b#quiz-0', false)
  const s = stats(p, lessons)
  expect(s.xp).toBe(4 * 10 + 2 * 50 + 5 * 20)
  expect(s).toMatchObject({ done: 2, total: 4, right: 5, answered: 6 })
  expect(s.badges.map((b) => [b.id, b.earned])).toEqual([['first-lesson', true], ['halfway', true], ['path', false], ['sharp', true]])
  expect(s.status('/learn/a')).toBe('done')
  expect(s.status('/learn/c')).toBe('current') // the first lesson not done yet
  expect(s.status('/learn/d')).toBe('locked')
  expect(stats(empty(), lessons).status('/learn/a')).toBe('current')
  // Lessons no longer in the path don't count.
  expect(stats(finish(empty(), '/learn/gone'), lessons).done).toBe(0)
})

test('load and save: one key, versioned; anything else, or storage that throws, is a fresh start', () => {
  const store = memory()
  save(finish(empty(), '/learn/a'), store)
  expect(JSON.parse(store.data.get('clarusjs-learn')!)).toMatchObject({ v: 1, done: ['/learn/a'] })
  expect(load(store).done).toEqual(['/learn/a'])
  store.setItem('clarusjs-learn', '{"v":0,"done":["x"]}')
  expect(load(store)).toEqual(empty())
  store.setItem('clarusjs-learn', 'not json')
  expect(load(store)).toEqual(empty())
  const blocked = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') }, removeItem: () => { throw new Error('denied') } }
  expect(load(blocked)).toEqual(empty())
  expect(save(empty(), blocked)).toBe(false)
  expect(save(empty(), store)).toBe(true)
  reset(store)
  expect(store.data.has('clarusjs-learn')).toBe(false)
})

test('storage that throws when touched at all (a blocked localStorage getter) is a fresh start too', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError') } })
  try {
    expect(load()).toEqual(empty())
    expect(save(empty())).toBe(false)
    expect(() => reset()).not.toThrow()
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage
  }
})
