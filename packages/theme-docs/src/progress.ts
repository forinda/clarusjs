// Learning progress: steps seen, lessons finished and first answers to quizzes, in one versioned localStorage key.
// Nothing leaves the browser. XP and badges are computed from it, never stored. Used by the Learn islands.

export type Progress = {
  v: 1
  /** Step ids done, by lesson path. */
  steps: Record<string, string[]>
  /** Lesson paths finished. */
  done: string[]
  /** First answer to each quiz (`<lesson>#<quiz name>`): right or not. */
  quizzes: Record<string, boolean>
}
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>

export const KEY = 'clarusjs-learn'
export const empty = (): Progress => ({ v: 1, steps: {}, done: [], quizzes: {} })

// Storage is looked up inside try: a blocked localStorage throws as soon as it is read.
const local = (): Storage => globalThis.localStorage

/** The saved progress; a fresh start when there is none, it is from another version, or storage is blocked. */
export function load(storage?: Storage): Progress {
  try {
    const saved = JSON.parse((storage ?? local()).getItem(KEY) ?? 'null') as Progress | null
    return saved?.v === 1 && Array.isArray(saved.done) ? saved : empty()
  } catch {
    return empty()
  }
}

/** Saves it; false when storage is blocked (progress then lasts as long as the page). */
export function save(progress: Progress, storage?: Storage): boolean {
  try {
    (storage ?? local()).setItem(KEY, JSON.stringify(progress))
    return true
  } catch {
    return false
  }
}

export function reset(storage?: Storage): void {
  try { (storage ?? local()).removeItem(KEY) } catch {}
}

export function step(p: Progress, lesson: string, id: string): Progress {
  const seen = p.steps[lesson] ?? []
  return seen.includes(id) ? p : { ...p, steps: { ...p.steps, [lesson]: [...seen, id] } }
}

export function finish(p: Progress, lesson: string): Progress {
  return p.done.includes(lesson) ? p : { ...p, done: [...p.done, lesson] }
}

/** Only the first answer counts. */
export function answer(p: Progress, quiz: string, right: boolean): Progress {
  return quiz in p.quizzes ? p : { ...p, quizzes: { ...p.quizzes, [quiz]: right } }
}

export type Badge = { id: string; title: string; text: string; earned: boolean }
export type Stats = {
  xp: number
  done: number
  total: number
  right: number
  answered: number
  badges: Badge[]
  /** A lesson's state in the path: done, current (the first not done) or locked (after it). */
  status(lesson: string): 'done' | 'current' | 'locked'
}

/** XP (10 a step, 50 a lesson, 20 a quiz right the first time), counts and badges, for the lessons of a path. */
export function stats(p: Progress, lessons: readonly string[]): Stats {
  const done = lessons.filter((l) => p.done.includes(l)).length
  const steps = lessons.reduce((n, l) => n + (p.steps[l]?.length ?? 0), 0)
  const answers = Object.values(p.quizzes)
  const right = answers.filter(Boolean).length
  const current = lessons.find((l) => !p.done.includes(l))
  const badges: Badge[] = [
    { id: 'first-lesson', title: 'First lesson', text: 'Finish a lesson.', earned: done >= 1 },
    { id: 'halfway', title: 'Halfway', text: 'Finish half the lessons.', earned: lessons.length > 1 && done >= Math.ceil(lessons.length / 2) },
    { id: 'path', title: 'Path complete', text: 'Finish every lesson.', earned: lessons.length > 0 && done === lessons.length },
    { id: 'sharp', title: 'Sharp', text: 'Answer 5 quizzes right the first time.', earned: right >= 5 },
  ]
  return {
    xp: steps * 10 + done * 50 + right * 20,
    done,
    total: lessons.length,
    right,
    answered: answers.length,
    badges,
    status: (lesson) => (p.done.includes(lesson) ? 'done' : lesson === current ? 'current' : 'locked'),
  }
}
