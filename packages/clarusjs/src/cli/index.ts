#!/usr/bin/env node
// The clarusjs command line. `clarusjs check [--json] [dir]` type-checks a project's templates.
import { check } from './check.ts'

const [command, ...args] = process.argv.slice(2)
const json = args.includes('--json')
const root = args.find((a) => !a.startsWith('--')) ?? process.cwd()

if (command === 'check') {
  const result = check({ root })
  if (json) console.log(result.json)
  else if (result.diagnostics.length) {
    console.log(result.text)
    console.log(`\n${result.diagnostics.length} error${result.diagnostics.length === 1 ? '' : 's'}`)
  } else console.log('No errors.')
  process.exitCode = result.exitCode
} else {
  console.log('Usage: clarusjs check [--json] [dir]')
  process.exitCode = command ? 1 : 0
}
