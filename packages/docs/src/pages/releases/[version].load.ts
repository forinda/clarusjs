import { release, releases } from '~/releases.ts'

/** One release-notes page per version in the CHANGELOG. */
export function entries() {
  return releases.map((r) => ({ version: r.version }))
}

/** The page's data: runs at build, once per version. */
export function load({ params }: { params: { version: string } }) {
  return { release: release(params.version) }
}
