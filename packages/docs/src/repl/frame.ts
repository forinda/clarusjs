// The playground's preview: a whole document for a sandboxed <iframe srcdoc>. Its one module script is the runtime
// (runtime-entry.ts, bundled); the page then posts it compiled code. Opaque origin: no access to the site's storage.

/** The preview document, `runtime` its module script as a data: URL (never parsed as HTML, so no escaping to get wrong). */
export function frameDoc(runtime: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; line-height: 1.5 }
  body { margin: 16px; background: Canvas; color: CanvasText }
  button, input, select, textarea { font: inherit; font-size: 14px; padding: 4px 10px; border: 1px solid color-mix(in srgb, CanvasText 30%, transparent); border-radius: 6px; background: Canvas; color: CanvasText }
  button { cursor: pointer }
  .cl-repl-error { color: #b3261e; white-space: pre-wrap; font-family: ui-monospace, monospace; font-size: 13px }
</style>
</head>
<body>
<div id="out"></div>
<script type="module" src="data:text/javascript;base64,${base64(runtime)}"></script>
</body>
</html>
`
}

/** UTF-8 base64 (btoa takes Latin-1 only). */
function base64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
