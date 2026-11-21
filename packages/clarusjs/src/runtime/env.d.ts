// import.meta.env as Vite provides it: development-only code checks `import.meta.env?.DEV`, which Vite replaces at
// build time, so a production build drops that code. Other bundlers leave it undefined: no dev-only code runs.
interface ImportMeta {
  readonly env?: { readonly DEV?: boolean }
}
