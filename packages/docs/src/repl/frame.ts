// The playground's preview: a whole document for a sandboxed <iframe srcdoc>. Its one module script is the runtime
// (runtime-entry.ts, bundled); the page then posts it compiled code. Opaque origin: no access to the site's storage.

/** The preview document, `runtime` inlined (a `</script` in it can't end the script early). */
export function frameDoc(runtime: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; line-height: 1.5 }
  body { margin: 16px; background: Canvas; color: CanvasText }
  .cl-repl-error { color: #b3261e; white-space: pre-wrap; font-family: ui-monospace, monospace; font-size: 13px }
</style>
</head>
<body>
<div id="out"></div>
<script type="module">${runtime.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`
}
