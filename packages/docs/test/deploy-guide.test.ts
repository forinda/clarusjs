// #601: the deploy guide's Dockerfile and .dockerignore are examples/docker's, which CI builds and runs
// (scripts/docker-smoke.sh), so the copy people paste is the one that's tested.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const guide = readFileSync(resolve(import.meta.dirname, '../src/pages/guide/deploy.md'), 'utf8')
const example = (file: string) => readFileSync(resolve(import.meta.dirname, '../../../examples/docker', file), 'utf8')
const block = (file: string) => new RegExp('```\\w+ \\[' + file.replace(/[.-]/g, '\\$&') + '\\]\\n([\\s\\S]*?)```').exec(guide)?.[1]

test('the guide shows examples/docker/Dockerfile as it is', () => {
  expect(block('Dockerfile')).toBe(example('Dockerfile'))
})

test('the guide shows the pnpm Dockerfiles (one package, a workspace) as they are', () => {
  expect(block('Dockerfile.pnpm')).toBe(example('Dockerfile.pnpm'))
  expect(block('Dockerfile.pnpm-monorepo')).toBe(example('Dockerfile.pnpm-monorepo'))
})

test('the guide shows examples/docker/.dockerignore as it is', () => {
  expect(block('.dockerignore')).toBe(example('.dockerignore'))
})
