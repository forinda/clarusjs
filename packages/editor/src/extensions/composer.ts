// The composer's extensions, in one list: what <editor-composer> runs, and what the server validates it with.
import type { Extension } from '../core/extension.ts'
import { base } from './base.ts'
import { codeBlock } from './code-block.ts'
import { history } from './history.ts'
import { link } from './link.ts'
import { markdownShortcuts } from './markdown-shortcuts.ts'
import { bold, code, italic } from './marks.ts'
import { mention } from './mention.ts'
import { placeholder } from './placeholder.ts'

const lists = new Map<string, Extension[]>()

/**
 * The composer's extensions. The same options give the same list (so the server's schema is built once): validate
 * with exactly what the composer runs.
 * @example
 * // on the server
 * const result = validate(body, composerExtensions({ codeBlocks: false }), { maxLength: 2000 })
 * @see https://clarusjs.com/guide/editor-composer#on-the-server
 */
export function composerExtensions(options: { codeBlocks?: boolean; mentions?: boolean; placeholder?: string } = {}): Extension[] {
  const { codeBlocks = true, mentions = true, placeholder: text } = options
  const key = JSON.stringify([codeBlocks, mentions, text ?? null])
  let list = lists.get(key)
  if (!list) {
    list = [base, bold, italic, code, link, ...(codeBlocks ? [codeBlock] : []), ...(mentions ? [mention] : []), markdownShortcuts, history, ...(text ? [placeholder(text)] : [])]
    lists.set(key, list)
  }
  return list
}
