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

/** Starts (or restarts) the server, one at a time: a restart asked for during a start runs after it. */
let queue = Promise.resolve()
const restart = (context: vscode.ExtensionContext) =>
  (queue = queue.then(async () => {
    await client?.stop()
    await start(context)
  }))

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Listening before the first start: trust granted while it starts still restarts the server with it.
  context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => restart(context)))
  await restart(context)
}

export function deactivate(): Promise<void> | undefined {
  return client?.stop()
}
