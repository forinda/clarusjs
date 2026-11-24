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
  {
    name: 'input',
    title: 'Input',
    description: 'A native text field, styled, with an invalid state from aria-invalid.',
    files: ['input.tscl'],
    parts: [],
    uses: [],
    island: false,
  },
  {
    name: 'textarea',
    title: 'Textarea',
    description: 'A native multi-line text field that grows with resize.',
    files: ['textarea.tscl'],
    parts: [],
    uses: [],
    island: false,
  },
  {
    name: 'label',
    title: 'Label',
    description: 'A native label for a field.',
    files: ['label.tscl'],
    parts: [],
    uses: [],
    island: false,
  },
  {
    name: 'card',
    title: 'Card',
    description: 'A box with a header, a body and a footer.',
    files: ['card.tscl'],
    parts: [],
    uses: [],
    island: false,
  },
  {
    name: 'badge',
    title: 'Badge',
    description: 'A short label, in four variants.',
    files: ['badge.tscl'],
    parts: [],
    uses: [],
    island: false,
  },
  {
    name: 'alert',
    title: 'Alert',
    description: 'A message box with a title, plain or destructive.',
    files: ['alert.tscl'],
    parts: [],
    uses: [],
    island: false,
  },
  {
    name: 'separator',
    title: 'Separator',
    description: 'A line between content, horizontal or vertical.',
    files: ['separator.tscl'],
    parts: [],
    uses: [],
    island: false,
  },
  {
    name: 'skeleton',
    title: 'Skeleton',
    description: 'A pulsing placeholder while content loads.',
    files: ['skeleton.tscl'],
    parts: [],
    uses: [],
    island: false,
  },
  {
    name: 'avatar',
    title: 'Avatar',
    description: 'A round picture of someone, or their initials.',
    files: ['avatar.tscl'],
    parts: [],
    uses: [],
    island: false,
  },
  {
    name: 'kbd',
    title: 'Kbd',
    description: 'A key to press, as in Ctrl K.',
    files: ['kbd.tscl'],
    parts: [],
    uses: [],
    island: false,
  },
  {
    name: 'table',
    title: 'Table',
    description: 'A native table that scrolls sideways on small screens.',
    files: ['table.tscl'],
    parts: [],
    uses: [],
    island: false,
  },
]
