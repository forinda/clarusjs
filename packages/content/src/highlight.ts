// Build-time code highlighting with Shiki. Synchronous (the JavaScript regex engine, grammars imported up front),
// because a page source turns Markdown into .tscl synchronously. Nothing here reaches the browser.
import { createRequire } from 'node:module'
import { createHighlighterCoreSync, type HighlighterCore, type LanguageRegistration, type ShikiTransformer } from 'shiki/core'
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
import zig from 'shiki/langs/zig.mjs'
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
  langs: [angularHtml, bash, css, diff, html, javascript, json, markdown, toml, tsx, typescript, yaml, zig],
  engine: createJavaScriptRegexEngine(),
}))

const load = createRequire(import.meta.url)
/** Shiki's grammar for a language name, from this package's own Shiki (the site installs nothing). */
function grammar(name: string): LanguageRegistration[] {
  const fail = () => { throw new Error(`@clarusjs/content: Shiki has no grammar "${name}"`) }
  if (!/^[a-z0-9][a-z0-9+#.-]*$/i.test(name) || name.includes('..')) fail() // a name, never a path
  try {
    // require(): synchronous, as highlighting is (Node 22.12+ loads ES modules this way)
    return (load(`shiki/langs/${name}.mjs`) as { default: LanguageRegistration[] }).default
  } catch {
    return fail()
  }
}

/**
 * More languages: names of Shiki's grammars (`'rust'`, `'go'`), loaded from this package's own Shiki, or grammars
 * of your own. A language already loaded is left as is.
 */
export function addLanguages(langs: (string | LanguageRegistration | LanguageRegistration[])[]): void {
  const hl = get()
  const loaded = new Set(hl.getLoadedLanguages())
  const add = langs.flatMap((l) => (typeof l === 'string' ? (loaded.has(l) ? [] : grammar(l)) : l)).filter((l) => !loaded.has(l.name))
  if (add.length) hl.loadLanguageSync(add)
}

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
