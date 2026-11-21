// The clarusjs language server: Volar's server with the .tscl language plugin, the clarusjs service plugin, and the
// HTML, CSS and Emmet services, over one project index per workspace folder.
import { readFileSync } from 'node:fs'
import { createConnection, createServer, createSimpleProject } from '@volar/language-server/node.js'
import { create as createCssService } from 'volar-service-css'
import { create as createEmmetService } from 'volar-service-emmet'
import { create as createHtmlService } from 'volar-service-html'
import { URI } from 'vscode-uri'
import { bindingsProvider } from './bindings.ts'
import { loadCompiler, type Compiler } from './compiler.ts'
import { loadFormatter } from './format.ts'
import { createTsclServicePlugin } from './plugin/index.ts'
import { pickProject, Project } from './project.ts'
import { fileRenameEdits } from './references.ts'
import { tsclLanguagePlugin } from './virtual-code.ts'

/** `initializationOptions`: whether the editor trusts the workspace (so the project's own clarusjs may load). */
export type ServerOptions = { trusted?: boolean }

export function startServer(): void {
  const connection = createConnection()
  const server = createServer(connection)
  const projects: Project[] = []
  let loose: Project | undefined // files outside every workspace folder (or with none open)
  let trusted = false
  let folders: string[] = []
  let watchFolders = false // the editor sends folder changes (asking for them otherwise throws, ending the server)
  const log = (message: string) => connection.console.info(message)
  const projectFor = (path: string) => pickProject(projects, path, loose!)
  /**
   * Index a workspace folder (after `initialize` answers: a big one mustn't hold the editor up). `mayTrust`: the
   * folder was open when the editor told us it trusts the workspace; one added later wasn't part of that, so it gets
   * the bundled compiler (the trust check runs again when the editor restarts the server).
   */
  const addFolder = async (root: string, mayTrust: boolean) => {
    const project = new Project(root, await loadCompiler(root, trusted && mayTrust, log))
    project.format = await loadFormatter(root, trusted && mayTrust, log)
    projects.push(project)
    await project.load()
  }

  connection.listen()
  connection.onInitialize(async (params) => {
    trusted = (params.initializationOptions as ServerOptions | undefined)?.trusted === true
    watchFolders = params.capabilities.workspace?.workspaceFolders === true
    folders = params.workspaceFolders?.map((f) => URI.parse(f.uri).fsPath) ?? (params.rootUri ? [URI.parse(params.rootUri).fsPath] : [])
    const compiler: Compiler = await loadCompiler(folders[0] ?? process.cwd(), trusted && folders.length > 0, () => {})
    loose = new Project(process.cwd(), compiler)
    // clarusjs first: where one answer wins (hover, rename), a component tag is ours, not the HTML service's.
    const result = await server.initialize(params, createSimpleProject([tsclLanguagePlugin]), [
      createTsclServicePlugin(projectFor),
      // The binding forms of HTML attributes ([disabled], (click), [(value)]) as extra HTML data.
      createHtmlService({ getCustomData: () => [bindingsProvider()] }),
      createCssService(),
      createEmmetService(),
    ])
    result.capabilities.workspace = { ...result.capabilities.workspace, workspaceFolders: { supported: true, changeNotifications: true } }
    return result
  })
  connection.onInitialized(async () => {
    server.initialized()
    void server.fileWatcher.watchFiles(['**/*.tscl', '**/src/pages/**/*.md', '**/tsconfig.json', '**/jsconfig.json'])
    for (const root of folders) await addFolder(root, true)
    await server.languageFeatures.requestRefresh(false)
    // Folders added later are indexed too; removed ones dropped.
    if (watchFolders) connection.workspace.onDidChangeWorkspaceFolders(async ({ added, removed }) => {
      for (const f of removed) {
        const root = URI.parse(f.uri).fsPath
        const at = projects.findIndex((p) => p.root === root)
        if (at !== -1) projects.splice(at, 1)
      }
      for (const f of added) await addFolder(URI.parse(f.uri).fsPath, false)
      await server.languageFeatures.requestRefresh(false)
    })
  })
  server.fileWatcher.onDidChangeWatchedFiles(({ changes }) => {
    for (const change of changes) {
      const path = URI.parse(change.uri).fsPath
      if (path.endsWith('tsconfig.json') || path.endsWith('jsconfig.json')) { for (const p of projects) p.forgetConfig(); continue }
      if (change.type === 3) projectFor(path).remove(path) // deleted
      else {
        // An open buffer is what counts (its unsaved edits); disk only for closed files.
        const open = server.documents.get(URI.file(path))
        try { projectFor(path).update(path, open ? open.getText() : readFileSync(path, 'utf8')) } catch {}
      }
    }
  })
  // An open buffer counts from the moment it changes, not only when it's saved.
  server.documents.onDidChangeContent(({ document }) => {
    if (!document.uri.endsWith('.tscl')) return
    const path = URI.parse(document.uri).fsPath
    projectFor(path)?.update(path, document.getText())
  })
  // A buffer closed without saving: back to the file on disk, so later edits are built from what's really there.
  server.documents.onDidClose(({ document }) => {
    if (!document.uri.endsWith('.tscl')) return
    const path = URI.parse(document.uri).fsPath
    projectFor(path)?.restore(path)
  })
  // Several files moved at once (a multi-select drag): one edit set from all their final places, across every workspace
  // project. (No plugin declares file-rename edits, so Volar registers no handler of its own to replace this one.)
  connection.workspace.onWillRenameFiles(({ files }) => {
    const renames = files.map((f) => [URI.parse(f.oldUri).fsPath, URI.parse(f.newUri).fsPath] as [string, string]).filter(([old]) => old.endsWith('.tscl'))
    if (!renames.length) return null
    // (The connection's LSP types are an older copy of the same WorkspaceEdit shape.)
    return fileRenameEdits([...projects, loose!], renames) as never
  })
  connection.onShutdown(() => server.shutdown())
}
