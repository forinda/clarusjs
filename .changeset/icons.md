---
'clarusjs': minor
'@clarusjs/language-server': minor
'@clarusjs/ai': patch
---

Built-in icons: `<icon name="lucide:rocket" />` renders an inline SVG at build time from any Iconify set the project installs (`pnpm add -D @iconify-json/lucide`), with no JavaScript. It's 1em high with its width in proportion, takes the text colour, and is `aria-hidden` unless labelled. The name must be static; a missing set or icon is an error at `file:line:col` with the closest names, in the build, `clarusjs check` and the editor. The editor completes sets and icon names and previews an icon on hover; the MCP `compile` tool resolves icons too. New `clarusjs/icons` (Node only) reads the sets; `CompileOptions.icon` passes them to the compiler.
