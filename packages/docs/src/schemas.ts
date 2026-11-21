// Frontmatter schemas for markdown({ schema }) in vite.config.ts. Any Standard Schema works (Zod, Valibot, ArkType…);
// this one is written by hand, so the site needs no schema library.
import type { StandardSchema } from '@clarusjs/content'

type Issue = { message: string; path: string[] }

/** Guide pages: a title and description (head tags and search), and their place in the sidebar (group, order). */
export const guidePage: StandardSchema<{ title: string; description: string; group: string; order: number }> = {
  '~standard': {
    version: 1,
    vendor: 'clarusjs-docs',
    validate(value) {
      const data = (value ?? {}) as Record<string, unknown>
      const issues: Issue[] = []
      for (const key of ['title', 'description', 'group']) {
        if (typeof data[key] !== 'string' || !(data[key] as string).trim()) issues.push({ message: 'Expected a non-empty string', path: [key] })
      }
      if (!Number.isInteger(data.order)) issues.push({ message: 'Expected a whole number (its place in the sidebar group)', path: ['order'] })
      return issues.length ? { issues } : { value: data as { title: string; description: string; group: string; order: number } }
    },
  },
}
