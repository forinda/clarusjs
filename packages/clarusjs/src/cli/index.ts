#!/usr/bin/env node
// The clarusjs command line. Node only: nothing here is reachable from a browser bundle.
import { Command } from 'commander'
import { check } from './check.ts'
import { loadProject } from './project.ts'
import { explain } from './explain.ts'
import { serve } from './mapper.ts'

const program = new Command('clarusjs').description('clarusjs: clear, compiled views')

program
  .command('check')
  .description('type-check and lint every .tscl file under src/ and every page (Markdown pages too), reporting each finding where it is written')
  .argument('[dir]', 'project folder', '.')
  .option('--json', 'print diagnostics as JSON')
  .option('--strict', 'fail on lint warnings too')
  .option('--fix', 'apply lint fixes to the .tscl files (wrapping a component\'s several roots in <fragment>, …) before checking')
  .action(async (dir: string, options: { json?: boolean; strict?: boolean; fix?: boolean }) => {
    // The page sources (Markdown, …), Vite aliases and lint settings from the app's Vite config, as the build sees them.
    const result = check({ root: dir, ...(await loadProject(dir)), strict: options.strict, fix: options.fix })
    // With --json, stdout is the diagnostics only: the files it rewrote go to stderr.
    for (const file of result.fixed ?? []) (options.json ? console.error : console.log)(`fixed ${file}`)
    if (options.json) console.log(result.json)
    else if (result.diagnostics.length) {
      const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
      const errors = result.diagnostics.filter((d) => d.severity === 'error').length
      console.log(result.text)
      console.log(`\n${[errors && count(errors, 'error'), result.diagnostics.length - errors && count(result.diagnostics.length - errors, 'warning')].filter(Boolean).join(', ')}`)
    } else console.log('No errors.')
    process.exitCode = result.exitCode
  })

program
  .command('explain')
  .description('explain where each part of a built route runs: rendering, data, islands, JavaScript and CSS')
  .argument('[route]', 'a route such as /guide/intro; without one, every route is listed')
  .option('--root <dir>', 'project folder', '.')
  .option('--json', 'print the route manifest entry as JSON')
  .action((route: string | undefined, options: { root: string; json?: boolean }) => {
    const result = explain({ root: options.root, route })
    if (result.exitCode) console.error(result.text)
    else console.log(options.json ? result.json : result.text)
    process.exitCode = result.exitCode
  })

program
  .command('mapper')
  .description('the TypeScript 7.1 content mapper for .tscl files (TypeScript starts it; see https://clarusjs.com/guide/editor)')
  .action(() => serve())

program.parse()
