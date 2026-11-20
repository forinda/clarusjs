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
// The *-default GitHub themes: their token colours meet WCAG AA contrast (the classic github-light/dark don't).
import githubDark from 'shiki/themes/github-dark-default.mjs'
import githubLight from 'shiki/themes/github-light-default.mjs'

// .tscl templates read like Angular's: {{ }}, [prop], (event) and @if/@for, so they borrow its grammar.
const ALIASES: Record<string, string> = { tscl: 'angular-html', ts: 'typescript', js: 'javascript', sh: 'bash', shell: 'bash', zsh: 'bash', md: 'markdown', yml: 'yaml' }

// One change for WCAG AA: the light theme's comments (#6e7781, 4.55:1 on white, less on any tinted line) use GitHub's
// newer muted grey (#59636e, 5.9:1). Every other token in both themes already passes on its theme's background.
const light = JSON.parse(JSON.stringify(githubLight).replace(/#6e7781/gi, '#59636e'))

let highlighter: HighlighterCore | undefined
const get = () => (highlighter ??= createHighlighterCoreSync({
  themes: [light, githubDark],
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
    themes: { light: 'github-light-default', dark: 'github-dark-default' },
    defaultColor: false, // colours only as --shiki-light/--shiki-dark: the page's theme picks one with CSS
    meta: { __raw: meta },
    transformers,
  })
}
