#!/usr/bin/env node
// The clarusjs command line. Node only: nothing here is reachable from a browser bundle.
import { Command } from 'commander'
import { check } from './check.ts'
import { loadProject } from './project.ts'
import { explain } from './explain.ts'

const program = new Command('clarusjs').description('clarusjs: clear, compiled views')

program
  .command('check')
  .description('type-check every .tscl file under src/ and every page (Markdown pages too), reporting errors where they are written')
  .argument('[dir]', 'project folder', '.')
  .option('--json', 'print diagnostics as JSON')
  .action(async (dir: string, options: { json?: boolean }) => {
    // The page sources (Markdown, …) and Vite aliases from the app's Vite config, as the build sees them.
    const result = check({ root: dir, ...(await loadProject(dir)) })
    if (options.json) console.log(result.json)
    else if (result.diagnostics.length) {
      console.log(result.text)
      console.log(`\n${result.diagnostics.length} error${result.diagnostics.length === 1 ? '' : 's'}`)
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

program.parse()
