#!/usr/bin/env node
// The clarusjs command line. Node only: nothing here is reachable from a browser bundle.
import { Command } from 'commander'
import { check } from './check.ts'
import { loadProject } from './project.ts'
import { explain } from './explain.ts'
import { serve as mapper } from './mapper.ts'
import { serve } from '../node/serve.ts'
import { writeEnvTypes } from '../vite/env.ts'

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
    const project = await loadProject(dir)
    // The env option's types too (.clarusjs/env.d.ts), as dev and build write them: a fresh clone checks the same.
    if (project.env) writeEnvTypes(dir, project.env)
    const result = check({ root: dir, ...project, strict: options.strict, fix: options.fix })
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
  .action(() => mapper())

program
  .command('serve')
  .description('serve a built site (vite build first) on Node: its files, server routes and _headers; for any Node host or a container')
  .argument('[dir]', 'project folder', '.')
  .option('--port <port>', 'port (default: $PORT, else 3000)')
  .option('--host <host>', 'interface (default: $HOST, else 0.0.0.0)')
  .action(async (dir: string, options: { port?: string; host?: string }) => {
    const server = await serve({ root: dir, port: options.port === undefined ? undefined : Number(options.port), host: options.host })
    const address = server.address()
    console.log(`clarusjs: serving ${dir} at http://${typeof address === 'object' && address ? `${address.address === '0.0.0.0' ? 'localhost' : address.address}:${address.port}` : address}/`)
    // A container stops with SIGTERM: finish the requests in flight, then exit.
    for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => server.close(() => process.exit(0)))
  })

program.parse()
