#!/usr/bin/env node
// The clarusjs command line. Node only: nothing here is reachable from a browser bundle.
import { Command } from 'commander'
import { check } from './check.ts'

const program = new Command('clarusjs').description('clarusjs: clear, compiled views')

program
  .command('check')
  .description('type-check every .clarus file under src/ and report errors at file.clarus:line:col')
  .argument('[dir]', 'project folder', '.')
  .option('--json', 'print diagnostics as JSON')
  .action((dir: string, options: { json?: boolean }) => {
    const result = check({ root: dir })
    if (options.json) console.log(result.json)
    else if (result.diagnostics.length) {
      console.log(result.text)
      console.log(`\n${result.diagnostics.length} error${result.diagnostics.length === 1 ? '' : 's'}`)
    } else console.log('No errors.')
    process.exitCode = result.exitCode
  })

program.parse()
