// Build-time code highlighting with Shiki. Synchronous (the JavaScript regex engine, grammars imported up front),
// because a page source turns Markdown into .tscl synchronously. Nothing here reaches the browser.
import { createHighlighterCoreSync, type HighlighterCore, type ShikiTransformer } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import {
  transformerMetaHighlight,
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
} from '@shikijs/transformers'
import angularHtml from 'shiki/langs/angular-html.mjs'
import bash from 'shiki/langs/bash.mjs'
import css from 'shiki/langs/css.mjs'
import diff from 'shiki/langs/diff.mjs'
import html from 'shiki/langs/html.mjs'
import javascript from 'shiki/langs/javascript.mjs'
import json from 'shiki/langs/json.mjs'
import markdown from 'shiki/langs/markdown.mjs'
import toml from 'shiki/langs/toml.mjs'
import tsx from 'shiki/langs/tsx.mjs'
import typescript from 'shiki/langs/typescript.mjs'
import yaml from 'shiki/langs/yaml.mjs'
import githubDark from 'shiki/themes/github-dark.mjs'
import githubLight from 'shiki/themes/github-light.mjs'

// .tscl templates read like Angular's: {{ }}, [prop], (event) and @if/@for, so they borrow its grammar.
const ALIASES: Record<string, string> = { tscl: 'angular-html', ts: 'typescript', js: 'javascript', sh: 'bash', shell: 'bash', zsh: 'bash', md: 'markdown', yml: 'yaml' }

let highlighter: HighlighterCore | undefined
const get = () => (highlighter ??= createHighlighterCoreSync({
  themes: [githubLight, githubDark],
  langs: [angularHtml, bash, css, diff, html, javascript, json, markdown, toml, tsx, typescript, yaml],
  engine: createJavaScriptRegexEngine(),
}))

const transformers: ShikiTransformer[] = [
  transformerNotationDiff(),
  transformerNotationFocus(),
  transformerNotationHighlight(),
  transformerNotationErrorLevel(),
  transformerMetaHighlight(),
]

/** Highlighted <pre> for `code` in `lang` (unknown languages are plain text); `meta` carries `{1,3-5}`. */
export function highlight(code: string, lang: string, meta: string): string {
  const hl = get()
  const id = ALIASES[lang] ?? lang
  const known = hl.getLoadedLanguages().includes(id)
  return hl.codeToHtml(code, {
    lang: known ? id : 'text',
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false, // colours only as --shiki-light/--shiki-dark: the page's theme picks one with CSS
    meta: { __raw: meta },
    transformers,
  })
}
