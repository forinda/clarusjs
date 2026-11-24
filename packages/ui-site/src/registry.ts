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
  /** For a styled part: the sections of @clarusjs/ui's ui.css its global rules copy, in order (a .tscl's
   *  <style global>, or a whole .css file for parts used as a set). */
  sections?: string[]
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
  {
    name: 'accordion',
    title: 'Accordion',
    description: 'Questions that open one at a time, on native details.',
    files: ['accordion.tscl'],
    parts: ['accordion-item.tscl'],
    uses: [],
    island: false,
    since: '0.1.0',
    sections: ['focus', 'buttons', 'accordion', 'motion'],
  },
  {
    name: 'checkbox',
    title: 'Checkbox',
    description: 'A native checkbox with its label.',
    files: ['checkbox.tscl'],
    parts: ['checkbox.tscl'],
    uses: [],
    island: true,
    since: '0.1.0',
    sections: ['focus', 'switch-checkbox', 'motion'],
  },
  {
    name: 'switch',
    title: 'Switch',
    description: 'An on/off switch on a native checkbox.',
    files: ['switch.tscl'],
    parts: ['switch.tscl'],
    uses: [],
    island: true,
    since: '0.1.0',
    sections: ['focus', 'switch-checkbox', 'motion'],
  },
  {
    name: 'radio-group',
    title: 'Radio group',
    description: 'Native radios in a fieldset: one choice from a few.',
    files: ['radio-group.tscl'],
    parts: ['radio-group.tscl', 'radio.tscl'],
    uses: [],
    island: true,
    since: '0.1.0',
    sections: ['focus', 'radio-group', 'motion'],
  },
  {
    name: 'field',
    title: 'Field',
    description: 'A label, an input, a description and an error, wired together.',
    files: ['field.tscl'],
    parts: ['field.tscl'],
    uses: [],
    island: true,
    since: '0.1.0',
    sections: ['focus', 'field-select', 'motion'],
  },
  {
    name: 'dialog',
    title: 'Dialog',
    description: 'A modal dialog on native <dialog>: focus kept in it, Escape and a click outside close it.',
    files: ['dialog.css'],
    parts: ['dialog.tscl', 'dialog-trigger.tscl', 'dialog-close.tscl'],
    uses: [],
    island: false,
    since: '0.1.0',
    sections: ['focus', 'buttons', 'dialog', 'motion'],
  },
  {
    name: 'popover',
    title: 'Popover',
    description: 'A panel anchored to its trigger, on the popover attribute.',
    files: ['popover.css'],
    parts: ['popover.tscl', 'popover-trigger.tscl'],
    uses: [],
    island: false,
    since: '0.1.0',
    sections: ['focus', 'buttons', 'popover', 'motion'],
  },
  {
    name: 'tooltip',
    title: 'Tooltip',
    description: 'A short hint on hover and focus.',
    files: ['tooltip.css'],
    parts: ['tooltip.tscl', 'tooltip-trigger.tscl'],
    uses: [],
    island: true,
    since: '0.1.0',
    sections: ['focus', 'buttons', 'tooltip', 'motion'],
  },
  {
    name: 'menu',
    title: 'Menu',
    description: 'A menu of actions: arrow keys, typeahead, Escape.',
    files: ['menu.css'],
    parts: ['menu.tscl', 'menu-trigger.tscl', 'menu-list.tscl', 'menu-item.tscl'],
    uses: [],
    island: true,
    since: '0.1.0',
    sections: ['focus', 'buttons', 'menu', 'motion'],
  },
]
