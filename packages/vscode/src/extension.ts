// The extension's code: the client of the clarusjs language server (bundled as dist/server.js), started over IPC for
// .tscl files. The server gives template errors, HTML/CSS/Emmet, components, references, renames and semantic
// tokens; TypeScript inside templates comes from TypeScript itself through the content mapper.
import * as vscode from 'vscode'
import { LanguageClient, TransportKind, type LanguageClientOptions, type ServerOptions } from 'vscode-languageclient/node'

let client: LanguageClient | undefined

async function start(context: vscode.ExtensionContext): Promise<void> {
  const module = context.asAbsolutePath('dist/server.js')
  const serverOptions: ServerOptions = {
    run: { module, transport: TransportKind.ipc },
    debug: { module, transport: TransportKind.ipc, options: { execArgv: ['--nolazy', '--inspect=6012'] } },
  }
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: 'tscl' }],
    // The project's own clarusjs compiler loads only in a trusted workspace.
    initializationOptions: { trusted: vscode.workspace.isTrusted },
  }
  client = new LanguageClient('clarusjs', 'clarusjs', serverOptions, clientOptions)
  await client.start()
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  await start(context)
  context.subscriptions.push(
    // Trust changes which compiler the server may load: start it again.
    vscode.workspace.onDidGrantWorkspaceTrust(async () => {
      await client?.stop()
      await start(context)
    }),
  )
}

export function deactivate(): Promise<void> | undefined {
  return client?.stop()
}
