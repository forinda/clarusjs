import { releases } from '../../releases.ts'

/** One release-notes page per version in the CHANGELOG. */
export function entries() {
  return releases.map((r) => ({ version: r.version }))
}
