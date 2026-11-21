#!/usr/bin/env node
// The clarusjs language server: `clarusjs-ls --stdio` (or --node-ipc, as VS Code starts it).
import('../dist/server.js').then((m) => m.startServer())
