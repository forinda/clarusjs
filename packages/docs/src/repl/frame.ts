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
  /* The preview's default look: a small classless stylesheet, so examples look finished without CSS of their own.
     Everything is inside :where() (no specificity): an example's own <style> always wins. */
  :where(:root) {
    color-scheme: light dark;
    --accent: #0b6e70; --accent-fg: #fff; --rule: color-mix(in srgb, CanvasText 18%, transparent);
    --muted: color-mix(in srgb, CanvasText 62%, transparent); --bad: #b3261e; --good: #1a7f37;
    font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  @media (prefers-color-scheme: dark) { :where(:root) { --accent: #5fd3d5; --accent-fg: #0b1f20; --bad: #ff8a80; --good: #7ee787; } }
  :where(body) { margin: 0; padding: 20px; background: Canvas; color: CanvasText; }
  :where(h1, h2, h3) { line-height: 1.25; margin: 0 0 12px; }
  :where(h1) { font-size: 24px; } :where(h2) { font-size: 19px; } :where(h3) { font-size: 16px; }
  :where(p) { margin: 0 0 12px; }
  :where(a) { color: var(--accent); }
  :where(code) { font: 13px ui-monospace, SFMono-Regular, Menlo, monospace; background: color-mix(in srgb, CanvasText 8%, transparent); padding: 1px 5px; border-radius: 4px; }
  :where(ul, ol) { margin: 0 0 12px; padding-left: 22px; }
  :where(li) { margin: 4px 0; }
  :where(hr) { border: 0; border-top: 1px solid var(--rule); margin: 16px 0; }
  :where(table) { border-collapse: collapse; margin: 0 0 12px; }
  :where(th, td) { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--rule); }
  :where(button, input, select, textarea) { font: inherit; color: CanvasText; }
  :where(button) {
    padding: 6px 14px; border: 1px solid var(--rule); border-radius: 8px; background: color-mix(in srgb, CanvasText 5%, Canvas);
    cursor: pointer; font-weight: 500;
  }
  :where(button:hover) { border-color: var(--accent); }
  :where(button[type='submit'], form button:not([type])) { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
  :where(button:disabled) { opacity: 0.55; cursor: not-allowed; }
  :where(form, fieldset) > :where(button) { justify-self: start; }
  :where(li button) { padding: 2px 10px; font-size: 13px; margin-left: 8px; }
  :where(input:not([type='checkbox'], [type='radio']), select, textarea) {
    padding: 7px 10px; border: 1px solid var(--rule); border-radius: 8px; background: Canvas; min-width: 0;
  }
  :where(input, select, textarea, button):focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  :where(input[type='checkbox'], input[type='radio']) { accent-color: var(--accent); width: 16px; height: 16px; vertical-align: -3px; }
  :where(label) { font-weight: 500; }
  :where(label:has(input:not([type='checkbox'], [type='radio']), select, textarea)) { display: grid; gap: 4px; max-width: 440px; margin: 0 0 12px; }
  :where(label:has(input[type='checkbox'], input[type='radio'])) { font-weight: 400; display: inline-flex; align-items: center; gap: 8px; }
  :where(form) { display: grid; gap: 12px; max-width: 440px; margin: 0 0 16px; }
  :where(form:has(> input, > button)) { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; max-width: none; }
  :where(fieldset) { border: 0; padding: 0; margin: 0; display: grid; gap: 12px; min-width: 0; }
  :where(legend) { font-weight: 600; font-size: 17px; margin-bottom: 4px; }
  /* clarusjs/forms: a field and its message, invalid fields, and multi-step forms (one step shows). */
  :where([data-cl-field]) { display: grid; gap: 4px; }
  /* The message line is always there (empty or hidden: invisible), so an error showing up never moves the buttons
     below it: a click that starts as a field loses focus (and shows its error) still lands where it began. */
  :where([data-cl-message]) { display: block; min-height: 1.4em; color: var(--bad); font-size: 13px; }
  :where([data-cl-message][hidden]) { visibility: hidden; }
  :where([aria-invalid='true']) { border-color: var(--bad); }
  :where([data-cl-steps] [data-cl-step]:not([data-cl-current])) { display: none; }
  :where([role='status']:not(:empty)) { color: var(--good); font-weight: 500; }
  :where([role='alert']) { color: var(--bad); }
  .cl-repl-error { color: var(--bad); white-space: pre-wrap; font: 13px ui-monospace, monospace; }
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
