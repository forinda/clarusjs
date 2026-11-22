// The preview frame's runtime as one script: runtime-entry.ts bundled with clarusjs/runtime. Used by the Vite plugin
// below (virtual:repl-runtime) and by the e2e tests, which build it the same way.
import { fileURLToPath } from 'node:url'
import { build, type Plugin } from 'vite'

const entry = fileURLToPath(new URL('./runtime-entry.ts', import.meta.url))

/** runtime-entry.ts and what it imports, as one minified ES module. */
export async function bundleReplRuntime(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: { write: false, minify: true, lib: { entry, formats: ['es'], fileName: 'repl-runtime' }, rolldownOptions: { output: { codeSplitting: false } } },
  })
  const outputs = (Array.isArray(result) ? result : [result]) as { output: { type: string; code?: string }[] }[]
  return outputs[0]!.output.filter((o) => o.type === 'chunk').map((o) => o.code).join('\n')
}

const ID = 'virtual:repl-runtime'

/** `import runtime from 'virtual:repl-runtime'`: the bundle above, as a string. */
export function replRuntime(): Plugin {
  return {
    name: 'docs:repl-runtime',
    resolveId: (id) => (id === ID ? '\0' + ID : undefined),
    async load(id) {
      if (id !== '\0' + ID) return
      this.addWatchFile(entry) // ponytail: edits to clarusjs's runtime itself need a dev-server restart to reach the frame
      return `export default ${JSON.stringify(await bundleReplRuntime())}`
    },
  }
}
