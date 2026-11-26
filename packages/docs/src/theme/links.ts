// This site's own touches to the docs theme (#373), filled into its slots and replaced parts: the versions for the
// version menu, and the project's links for the footer and the phone drawer.
import pkg from '../../../clarusjs/package.json' with { type: 'json' }

/** The versions the menu lists, newest first. One for now: versioned docs (#129) add the older ones. */
export const versions: { label: string; href: string; current?: boolean }[] = [
  { label: `v${pkg.version} (latest)`, href: '/', current: true },
]
export const version = `v${pkg.version}`

/** The project's links: the site footer has them all, the phone drawer those its links row doesn't. */
export const projectLinks = [
  { label: 'GitHub', href: 'https://github.com/forinda/clarusjs' },
  { label: 'npm', href: 'https://www.npmjs.com/package/clarusjs' },
  { label: 'Releases', href: '/releases' },
  { label: 'For AI agents', href: '/guide/ai-coding' },
]
