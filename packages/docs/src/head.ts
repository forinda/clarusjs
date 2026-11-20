// Runs on every page's <head> after the title template and site tags (see the head option in vite.config.ts).
export function transformHead(head: string): string {
  return `${head}<meta name="generator" content="clarusjs">`
}
