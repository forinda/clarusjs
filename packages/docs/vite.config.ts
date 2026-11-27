import { defineConfig } from 'vite'
import clarusjs from 'clarusjs/vite'
import markdown, { highlightTemplates } from '@clarusjs/content'
import { themeDocs } from '@clarusjs/theme-docs/vite.js'
import { guidePage } from './src/schemas.ts'
import { replRuntime } from './src/repl/bundle.ts'
import { noInlineStyle } from './src/lint/no-inline-style.ts'

export default defineConfig({
  plugins: [
    // The sidebar from src/pages, search, and llms.txt / llms-full.txt for AI tools (llmstxt.org).
    themeDocs({
      // This site's footer, in place of the theme's (a part replaced: see the Docs theme guide).
      components: { footer: '/src/theme/footer.tscl' },
      llms: {
        title: 'clarusjs',
        summary: 'A compiler for .tscl components: HTML rendered on the server, and small islands that attach to it in the browser, with Vite.',
        site: 'https://clarusjs.com',
      },
    }),
    // The playground's preview runtime, bundled into one string (src/repl/bundle.ts).
    replRuntime(),
    // Code blocks in .tscl pages highlighted like Markdown's (before clarusjs compiles them).
    highlightTemplates(),
    clarusjs({
      // Rendered on every request; on Netlify, by a function (see the Server playground page).
      routes: { '/playground': 'server', '/tour/*': 'client', '/members/*': 'server' },
      adapter: 'netlify',
      // Moving between pages swaps the page instead of reloading it (see the Fragment navigation guide).
      fragments: true,
      // `pnpm docs:check` lints templates too: the built-in rules, and this site's own (see the Lint guide).
      lintRules: [noInlineStyle],
      // ui-primitives' parts are used by name, without @import (`<ui-tabs>`; see Components from libraries).
      components: { libraries: ['@clarusjs/ui-primitives'] },
      // Paths people type out of habit (see the Routing guide): a 301 on Netlify, a forwarding page anywhere else.
      redirects: { '/docs': '/guide/getting-started' },
      // The public address: canonical URLs and social cards on every page (public/og.png unless a page sets its own).
      site: { url: 'https://clarusjs.com', name: 'clarusjs', image: '/og.png' },
      // Every page's <head>: the title template and tags all pages share (src/head.ts adds the rest).
      head: {
        titleTemplate: '%s · clarusjs',
        tags: [
          ['link', { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' }],
          ['meta', { name: 'theme-color', content: '#0b6e70' }],
        ],
        // Structured data for search engines; each page adds its own TechArticle in the layout.
        jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'clarusjs', url: 'https://clarusjs.com' },
      },
      // Markdown pages (src/pages/**/*.md), rendered in the docs layout.
      sources: [markdown({
        layout: '/src/layouts/docs.tscl',
        // Components in src/components are used by tag, no @import needed (explicit imports still win).
        components: '/src/components',
        // ::: tip blocks and > [!NOTE] alerts render through the site's callout component.
        container: { tag: 'callout', from: '@clarusjs/theme-docs/callout.tscl' },
        // Every highlighted code block gets the site's copy button (an island that loads on first use).
        copy: { tag: 'copy', from: '@clarusjs/theme-docs/copy.tscl' },
        // ```mermaid blocks are diagrams, drawn by the theme's component when they scroll into view.
        mermaid: { tag: 'diagram', from: '@clarusjs/theme-docs/mermaid.tscl' },
        // Line numbers on every code block but shell commands.
        lineNumbers: true,
        // ::: quiz blocks in lessons render through the theme's quiz (its options are an island).
        quiz: { tag: 'quiz', from: '@clarusjs/theme-docs/quiz.tscl' },
        // Guide pages must have a title, description, sidebar group and order (src/schemas.ts).
        schema: { 'guide/**': guidePage },
      })],
    }),
  ],
})
