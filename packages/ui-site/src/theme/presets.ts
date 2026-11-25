// The builder's presets: every token in light and dark. teal is theme.css exactly (a test checks it); the others change
// the brand colour and its tints, and pass WCAG AA on every pair the builder checks (also tested).
import type { Theme } from './model.ts'

const teal: Theme = {
  light: {
    'font': 'system-ui, sans-serif',
    'font-heading': 'var(--ui-font)',
    'font-mono': 'ui-monospace, monospace',
    'font-size': '14px',
    'radius': '8px',
    'space': '4px',
    'bg': '#ffffff',
    'fg': '#17202a',
    'muted': '#5b6670',
    'border': '#c9d1d9',
    'accent': '#0b6e70',
    'accent-fg': '#ffffff',
    'accent-soft': '#e3f2f2',
    'danger': '#b42318',
    'shadow': '0 8px 24px rgb(0 0 0 / 0.14)',
    'card': '#ffffff',
    'card-fg': '#17202a',
    'popover': '#ffffff',
    'popover-fg': '#17202a',
    'secondary': '#e3f2f2',
    'secondary-fg': '#17202a',
    'muted-bg': '#e3f2f2',
    'accent-soft-fg': '#17202a',
    'danger-fg': '#ffffff',
    'input': '#c9d1d9',
    'ring': '#0b6e70',
    'sidebar': '#ffffff',
    'sidebar-fg': '#17202a',
    'sidebar-accent': '#e3f2f2',
    'sidebar-accent-fg': '#17202a',
    'sidebar-border': '#c9d1d9',
    'success': '#067647',
    'success-fg': '#ffffff',
    'warning': '#b54708',
    'warning-fg': '#ffffff',
    'chart-1': '#0b6e70',
    'chart-2': '#c2410c',
    'chart-3': '#4f46e5',
    'chart-4': '#a21caf',
    'chart-5': '#15803d',
  },
  dark: {
    'bg': '#121a1b',
    'fg': '#e6eded',
    'muted': '#9aa8a9',
    'border': '#2c3a3b',
    'accent': '#4cc9cb',
    'accent-fg': '#0b1415',
    'accent-soft': '#173233',
    'danger': '#ff8a80',
    'shadow': '0 8px 24px rgb(0 0 0 / 0.5)',
    'card': '#121a1b',
    'card-fg': '#e6eded',
    'popover': '#121a1b',
    'popover-fg': '#e6eded',
    'secondary': '#173233',
    'secondary-fg': '#e6eded',
    'muted-bg': '#173233',
    'accent-soft-fg': '#e6eded',
    'danger-fg': '#0b1415',
    'input': '#2c3a3b',
    'ring': '#4cc9cb',
    'sidebar': '#121a1b',
    'sidebar-fg': '#e6eded',
    'sidebar-accent': '#173233',
    'sidebar-accent-fg': '#e6eded',
    'sidebar-border': '#2c3a3b',
    'success': '#47cd89',
    'success-fg': '#0b1415',
    'warning': '#fdb022',
    'warning-fg': '#0b1415',
    'chart-1': '#4cc9cb',
    'chart-2': '#fdba74',
    'chart-3': '#a5b4fc',
    'chart-4': '#f0abfc',
    'chart-5': '#86efac',
  },
}

/** teal with another brand colour: accent, its text, and the tints that follow it (soft, secondary, muted surface, sidebar accent). */
function brand(light: [accent: string, fg: string, soft: string], dark: [accent: string, fg: string, soft: string]): Theme {
  const tint = (set: Record<string, string>, [accent, fg, soft]: [string, string, string]) =>
    ({ ...set, accent, 'accent-fg': fg, ring: accent, 'accent-soft': soft, secondary: soft, 'muted-bg': soft, 'sidebar-accent': soft })
  return { light: tint(teal.light, light), dark: tint(teal.dark, dark) }
}

export const presets = {
  teal,
  indigo: brand(['#4f46e5', '#ffffff', '#eef2ff'], ['#818cf8', '#0b1415', '#1e1b4b']),
  rose: brand(['#be123c', '#ffffff', '#fff1f2'], ['#fb7185', '#0b1415', '#4c0519']),
  amber: brand(['#b45309', '#ffffff', '#fffbeb'], ['#fbbf24', '#0b1415', '#451a03']),
  green: brand(['#15803d', '#ffffff', '#f0fdf4'], ['#4ade80', '#0b1415', '#052e16']),
  neutral: brand(['#18181b', '#ffffff', '#f4f4f5'], ['#fafafa', '#18181b', '#27272a']),
} satisfies Record<string, Theme>

export type PresetName = keyof typeof presets
