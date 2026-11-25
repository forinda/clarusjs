// The --ui-* tokens (without the --ui- prefix): @clarusjs/ui's original 11 first, then the 23 the theme builder added, then the 5 chart colours.
export const TOKEN_NAMES = [
  'font', 'radius', 'bg', 'fg', 'muted', 'border', 'accent', 'accent-fg', 'accent-soft', 'danger', 'shadow',
  'card', 'card-fg', 'popover', 'popover-fg', 'secondary', 'secondary-fg', 'muted-bg', 'accent-soft-fg', 'danger-fg',
  'input', 'ring', 'sidebar', 'sidebar-fg', 'sidebar-accent', 'sidebar-accent-fg', 'sidebar-border',
  'font-heading', 'font-mono', 'font-size', 'success', 'success-fg', 'warning', 'warning-fg', 'space',
  'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5',
] as const
