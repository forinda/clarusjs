// The playground runs compiled components from blob URLs, where bare imports can't resolve: each runtime import
// becomes a read from the copies the preview frame bundles (globalThis.__cl_repl).
const IMPORT = /^import\s*\{([^}]*)\}\s*from\s*'(clarusjs\/runtime(?:\/server)?)'\s*;?$/
const SUPPORTED = 'the playground supports imports from clarusjs/runtime only'

/** `code` (a compile() output) with its runtime imports as `const { … } = globalThis.__cl_repl[…]`. */
export function rewriteImports(code: string): string {
  return code.split('\n').map((line) => {
    if (!/^import[\s{]/.test(line)) return line
    const m = IMPORT.exec(line)
    if (!m) throw new Error(SUPPORTED)
    const names = m[1]!.split(',').map((n) => n.trim()).filter(Boolean).map((n) => n.replace(/\s+as\s+/, ': '))
    return `const { ${names.join(', ')} } = globalThis.__cl_repl['${m[2]}']`
  }).join('\n')
}
