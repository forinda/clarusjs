// When the release notes last changed: the newest commit to clarusjs's CHANGELOG.md, which /releases is built from
// (the page's own file rarely changes, so git's date for it would be stale). Build time only: the page sets it as its
// sitemap lastmod. Resolved from the working directory (the docs package), not import.meta.url (the bundle's place).
import { resolve } from 'node:path'
import { gitDates } from 'clarusjs/vite'

const changelog = resolve(process.cwd(), '../clarusjs/CHANGELOG.md')
const time = gitDates(resolve(process.cwd(), '../..'), changelog).get(changelog)

/** YYYY-MM-DD, or undefined outside git. */
export const changelogUpdated: string | undefined = time === undefined ? undefined : new Date(time * 1000).toISOString().slice(0, 10)
