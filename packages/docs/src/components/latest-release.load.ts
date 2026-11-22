// A component loader (#97): runs on the server for every page that uses <latestRelease />, at the same time as the
// other component loaders of that page, before it renders. This one reads the changelog at build time.
import { releases } from '../releases.ts'

export function load() {
  const latest = releases[0]
  return { version: latest?.version ?? '', changes: latest?.groups.reduce((n, g) => n + g.changes.length, 0) ?? 0 }
}
