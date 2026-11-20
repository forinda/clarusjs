// Release notes for the docs site, read from the package's CHANGELOG (written by changesets) at build time.
import changelog from '../../clarusjs/CHANGELOG.md?raw'

export type Change = { pr: string; url: string; text: string }
export type Release = { version: string; groups: { title: string; changes: Change[] }[] }

function parse(md: string): Release[] {
  return md.split(/^## /m).slice(1).map((block) => {
    const [version = '', ...rest] = block.split('\n')
    const groups = rest.join('\n').split(/^### /m).slice(1).map((g) => {
      const [title = '', ...lines] = g.split('\n')
      const changes = lines.join('\n').split(/^- /m).slice(1).map((item) => {
        const pr = /^\[#(\d+)\]\(([^)]+)\)/.exec(item)
        // "[#76](…) [`sha`](…) Thanks [@who](…)! - text": keep the text after the attribution.
        const text = item.replace(/^[\s\S]*?! - /, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
        return { pr: pr ? `#${pr[1]}` : '', url: pr ? pr[2]! : '', text }
      })
      return { title: title.trim(), changes }
    })
    return { version: version.trim(), groups }
  })
}

export const releases: Release[] = parse(changelog)

export function release(version: string): Release {
  return releases.find((r) => r.version === version) ?? { version, groups: [] }
}
