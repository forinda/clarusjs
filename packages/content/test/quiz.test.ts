// #158: ::: quiz blocks (lessons): static HTML that works without JavaScript, or a quiz component (an island).
import { expect, test } from 'vitest'
import { compile } from 'clarusjs/compiler'
import markdown from '../src/index.ts'

const lesson = '---\nsteps: true\n---\n'
const quiz = '::: quiz What does a `{{ }}` hole print?\n- [ ] Raw HTML\n- [x] The value, **escaped**\n- [ ] Nothing\n\nHoles always escape.\n:::\n'
const html = (code: string, options = {}) => markdown({ layout: false, ...options }).toTscl(code, '/a/src/pages/learn/x.md', { route: '/learn/x', root: '/a', addDependency: () => {} })
const server = (out: string) => compile(out.replace(/^@import.*\n/gm, ''), { file: 'x.tscl', target: 'server' })

test('a quiz is static HTML: the question, radio options, and the answer with its explanation in a <details>', () => {
  const out = html(lesson + quiz)
  expect(out).toContain('<div class="quiz" data-quiz="quiz-0">')
  expect(out).toContain('<p class="quiz-question" id="quiz-0-q">What does a <code>&#123;&#123; }}</code> hole print?</p>')
  expect(out).toContain('<div class="quiz-options" role="radiogroup" aria-labelledby="quiz-0-q">')
  expect(out).toContain('<label><input type="radio" name="quiz-0" value="1"> The value, escaped</label>')
  expect(out).toMatch(/<details class="quiz-answer"><summary>Show the answer<\/summary><p class="quiz-correct">Answer: The value, escaped<\/p>\n<p>Holes always escape\.<\/p>\n<\/details><\/div>/)
  expect(() => server(out)).not.toThrow()
})

test('two quizzes get their own names', () => {
  expect(html(lesson + quiz + '\n' + quiz)).toContain('name="quiz-1"')
})

test('with a quiz component, the quiz renders through it, the explanation in its slot', () => {
  const out = html(lesson + quiz, { quiz: { tag: 'quiz', from: '@clarusjs/theme-docs/quiz.tscl' } })
  expect(out).toMatch(/^@import quiz from '@clarusjs\/theme-docs\/quiz\.tscl'$/m)
  expect(out).toContain(`<quiz [name]="'quiz-0'" [question]="'What does a {{ }} hole print?'" [options]="['Raw HTML', 'The value, escaped', 'Nothing']" [answer]="1">`)
  expect(() => server(out)).not.toThrow()
  expect(out).toMatch(/<p>Holes always escape\.<\/p>\n<\/quiz>/)
})

test('a quiz needs exactly one right answer, and is for lessons unless quizzes are allowed everywhere', () => {
  expect(() => html(lesson + '::: quiz Q?\n- [ ] a\n- [ ] b\n:::\n')).toThrow(/x\.md: a quiz needs exactly one right answer \(- \[x\]\)/)
  expect(() => html(lesson + '::: quiz Q?\n- [x] a\n- [x] b\n:::\n')).toThrow(/exactly one right answer/)
  // A list after the block isn't its options.
  expect(() => html(lesson + '::: quiz Q?\nNo list.\n:::\n\n- [x] a\n')).toThrow(/exactly one right answer/)
  expect(() => html(quiz)).toThrow(/x\.md: ::: quiz is for lessons \(frontmatter steps: true\); markdown\(\{ quizzes: 'everywhere' \}\) allows it on any page/)
  expect(html(quiz, { quizzes: 'everywhere' })).toContain('class="quiz"')
})
