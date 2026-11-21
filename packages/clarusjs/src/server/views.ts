// render(name, props): any view under src/ rendered to HTML from server code (a loader, an endpoint, a script that
// imports the built server). The server entry registers the views; `clarusjs check` writes .clarusjs/views.d.ts,
// which types each name with that view's inputs.

type View = { render(props?: object): string }
type Registry = Record<string, () => Promise<View>>

/**
 * View name → inputs. Filled in by the generated .clarusjs/views.d.ts (declaration merging).
 * @see https://clarusjs.com/reference/server#render
 */
export interface Views {}

/**
 * Without the generated registry any name is accepted; with it, only real views.
 * @see https://clarusjs.com/reference/server#render
 */
export type ViewName = [keyof Views] extends [never] ? string : Extract<keyof Views, string>
/**
 * A view's props: its inputs, from the generated registry.
 * @see https://clarusjs.com/reference/server#render
 */
export type ViewProps<N> = N extends keyof Views ? Views[N] : Record<string, unknown>

/** '/src/components/pill.tscl' → 'components/pill' @internal */
export function viewName(file: string): string {
  return file.replace(/^.*?\/src\//, '').replace(/\.[^./]+$/, '')
}

// On globalThis: the bundled server and an app's own `import 'clarusjs/views'` may be two copies of this module.
const store = globalThis as { __clViews?: Map<string, () => Promise<View>> }

/** Called by the server entry with import.meta.glob('/src/**\/*.tscl'). @internal */
export function registerViews(files: Registry): void {
  store.__clViews = new Map(Object.entries(files).map(([file, load]) => [viewName(file), load]))
}

/**
 * Render a view (any `.tscl` under src/, by its path without the extension) to HTML, from server code: a `load()`,
 * an endpoint, a script importing the built server. Its props are checked against its inputs once `clarusjs check`
 * has generated the registry.
 * @example
 * ```ts
 * import { render } from 'clarusjs/views'
 * const html = await render('components/pill', { text: 'new' })
 * ```
 * @see https://clarusjs.com/reference/server#render
 */
export async function render<N extends ViewName>(name: N, props: ViewProps<N>): Promise<string> {
  const views = store.__clViews
  if (!views) throw new Error('clarusjs: no views are registered; render() runs in server code, after the server entry has loaded')
  const load = views.get(name)
  if (!load) throw new Error(`clarusjs: no view "${name}"; views: ${[...views.keys()].sort().join(', ')}`)
  return (await load()).render(props as object)
}
