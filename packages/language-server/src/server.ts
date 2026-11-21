// The clarusjs language server: Volar's server with the .tscl language plugin, the clarusjs service plugin, and the
// HTML, CSS and Emmet services, over one project index per workspace folder.
import { readFileSync } from 'node:fs'
import { sep } from 'node:path'
import { createConnection, createServer, createSimpleProject } from '@volar/language-server/node.js'
import { create as createCssService } from 'volar-service-css'
import { create as createEmmetService } from 'volar-service-emmet'
import { create as createHtmlService } from 'volar-service-html'
import { URI } from 'vscode-uri'
import { loadCompiler } from './compiler.ts'
import { createTsclServicePlugin } from './plugin/index.ts'
import { Project } from './project.ts'
import { tsclLanguagePlugin } from './virtual-code.ts'

/** `initializationOptions`: whether the editor trusts the workspace (so the project's own clarusjs may load). */
export type ServerOptions = { trusted?: boolean }

export function startServer(): void {
  const connection = createConnection()
  const server = createServer(connection)
  const projects: Project[] = []
  let loose: Project | undefined // files outside every workspace folder (or with none open)
  const projectFor = (path: string) => projects.find((p) => path === p.root || path.startsWith(p.root + sep)) ?? loose!

  connection.listen()
  connection.onInitialize(async (params) => {
    const trusted = (params.initializationOptions as ServerOptions | undefined)?.trusted === true
    const log = (message: string) => connection.console.info(message)
    const folders = params.workspaceFolders?.map((f) => URI.parse(f.uri).fsPath) ?? (params.rootUri ? [URI.parse(params.rootUri).fsPath] : [])
    for (const root of folders) {
      const project = new Project(root, await loadCompiler(root, trusted, log))
      await project.load()
      projects.push(project)
    }
    loose = new Project(process.cwd(), projects[0]?.compiler ?? (await loadCompiler(process.cwd(), false, log)))
    // clarusjs first: where one answer wins (hover, rename), a component tag is ours, not the HTML service's.
    return server.initialize(params, createSimpleProject([tsclLanguagePlugin]), [
      createTsclServicePlugin(projectFor),
      createHtmlService(),
      createCssService(),
      createEmmetService(),
    ])
  })
  connection.onInitialized(() => {
    server.initialized()
    void server.fileWatcher.watchFiles(['**/*.tscl', '**/src/pages/**/*.md'])
  })
  server.fileWatcher.onDidChangeWatchedFiles(({ changes }) => {
    for (const change of changes) {
      const path = URI.parse(change.uri).fsPath
      if (change.type === 3) projectFor(path).remove(path) // deleted
      else { try { projectFor(path).update(path, readFileSync(path, 'utf8')) } catch {} }
    }
  })
  // An open buffer counts from the moment it changes, not only when it's saved.
  server.documents.onDidChangeContent(({ document }) => {
    if (!document.uri.endsWith('.tscl')) return
    const path = URI.parse(document.uri).fsPath
    projectFor(path)?.update(path, document.getText())
  })
  connection.onShutdown(() => server.shutdown())
}
