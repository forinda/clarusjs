// Template errors: the compiler's, for the open file, at their place. A syntax error is left to the TypeScript 7.1
// content mapper when the project runs it (it reports them too, also for `tsc`), so one mistake isn't two errors.
import type { Diagnostic } from '@volar/language-service'
import { resolveIcon } from 'clarusjs/icons'
import { fromLineColumn } from '../positions.ts'
import type { Project } from '../project.ts'

export function diagnosticsFor(project: Project, path: string, text: string): Diagnostic[] {
  const { compile, parse, ClarusError, lint } = project.compiler
  try {
    // Warnings: things that compile but likely aren't meant. (A project's older clarusjs has none.)
    const warnings = (compile(text, { file: path, target: 'client', icon: (name) => resolveIcon(name, path) }).warnings ?? []).map((w) => diagnostic(w, 2))
    // Lint (#304), once the template compiles: the built-in rules at their default levels.
    // ponytail: the editor doesn't read the Vite config (its `lint` levels, `lintRules`); `clarusjs check` does.
    // Upgrade path: the trusted project's levels and rules, loaded as check loads them.
    const linted = (lint?.(text, path) ?? []).map((m) => ({ ...lintDiagnostic(m), code: m.rule }))
    return [...warnings, ...linted]
  } catch (err) {
    if (!(err instanceof ClarusError)) return []
    if (project.mapperConfigured(path)) {
      try { parse(text, path) } catch { return [] } // a syntax error: the mapper's
    }
    return [diagnostic(err, 1)]
  }
}

/** A lint finding: message and place are already separate. */
function lintDiagnostic(m: { message: string; line: number; column: number; severity: 'warning' | 'error' }): Diagnostic {
  const start = fromLineColumn(m.line, m.column)
  return { range: { start, end: { line: start.line, character: start.character + 1 } }, message: m.message, severity: m.severity === 'error' ? 1 : 2, source: 'clarusjs' }
}

/** A located compiler error or warning (1 error, 2 warning) as a diagnostic: its message without the location. */
function diagnostic(err: { message: string; file: string; line: number; column: number }, severity: 1 | 2): Diagnostic {
  const start = fromLineColumn(err.line, err.column)
  return {
    range: { start, end: { line: start.line, character: start.character + 1 } },
    message: err.message.slice(`${err.file}:${err.line}:${err.column} `.length),
    severity,
    source: 'clarusjs',
  }
}
