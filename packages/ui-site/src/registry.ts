// Every component people can copy: one entry per folder in src/registry/. The pages' "needs" lists and the home
// page's list come from here (and, later, the registry JSON a CLI would read).
export type Entry = {
  /** Folder, file and page name: 'button'. */
  name: string
  title: string
  /** One line, shown in lists and as the page's lead. */
  description: string
  /** Files under src/registry/<name>/; the first is the component. */
  files: string[]
  /** @clarusjs/ui-primitives parts it renders ('switch.tscl', …); [] if none. */
  parts: string[]
  /** Other entries it imports as ./<name>.tscl. */
  uses: string[]
  /** false: ships no JavaScript. */
  island: boolean
  /** The @clarusjs/ui-primitives version it needs, when parts is not empty. */
  since?: string
}

export const registry: Entry[] = [
  {
    name: 'button',
    title: 'Button',
    description: 'A native button in six variants and three sizes.',
    files: ['button.tscl'],
    parts: [],
    uses: [],
    island: false,
  },
]
