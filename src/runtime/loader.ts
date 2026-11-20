// Island loader: finds <cl-island> elements, loads each one's chunk, calls attach(). Browser only, ~20 lines.

type IslandModule = { attach(root: Element, props: Record<string, unknown>): void }

export async function attachAll(
  root: ParentNode = document,
  load: (src: string) => Promise<IslandModule> = (src) => import(/* @vite-ignore */ src),
): Promise<void> {
  const pending = [...root.querySelectorAll('cl-island:not([data-cl-ready])')].map(async (el) => {
    el.setAttribute('data-cl-ready', '')
    try {
      const mod = await load(el.getAttribute('src')!)
      mod.attach(el, JSON.parse(el.getAttribute('p') ?? '{}'))
    } catch (err) {
      console.error(`[clarusjs] island "${el.getAttribute('c')}" failed to attach`, err)
    }
  })
  await Promise.all(pending)
}

if (typeof document !== 'undefined') attachAll()
