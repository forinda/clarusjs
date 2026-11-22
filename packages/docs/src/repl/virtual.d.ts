/** The preview frame's runtime, bundled into one script (src/repl/bundle.ts). */
declare module 'virtual:repl-runtime' {
  const runtime: string
  export default runtime
}

/** Vite's worker import: `new CompileWorker()` starts src/repl/compile.worker.ts as a module worker. */
declare module '*?worker' {
  const WorkerConstructor: new () => Worker
  export default WorkerConstructor
}
