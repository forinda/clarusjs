import type { Plugin } from 'vite'
import type { PageInfo } from './nav.ts'

/** Reads src/pages (or `pages`, from the Vite root) for the sidebar and serves it as `virtual:theme-docs/pages`. */
export function themeDocs(options?: { pages?: string }): Plugin
/** Every page under `dir` with its sidebar entry (title, group, order). */
export function readPages(dir: string): PageInfo[]
