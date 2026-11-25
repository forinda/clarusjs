// A theme: every --ui- token's value in light and dark (tokens without a mode, like fonts and radius, are in light
// only). Turned into theme.css text, a dark set from a light one, a WCAG contrast check, and a compact link.
import { TOKEN_NAMES } from './names.ts'
import { presets, type PresetName } from './presets.ts'
import { DENSITIES, FONTS, HEADINGS, MONOS, SHADOWS } from './options.ts'

export type Mode = 'light' | 'dark'
export type Theme = { light: Record<string, string>; dark: Record<string, string> }

/** Tokens with one value for both modes. */
export const MODELESS = ['font', 'font-heading', 'font-mono', 'font-size', 'radius', 'space']
/** The spacing scale: --ui-space-N = N × --ui-space, written in the same rule as the unit. */
export const SPACE_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12]

/** Text/background pairs the builder checks for contrast (WCAG AA, 4.5:1). */
export const PAIRS: [fg: string, bg: string][] = [
  ['fg', 'bg'], ['muted', 'bg'], ['accent-fg', 'accent'], ['secondary-fg', 'secondary'], ['card-fg', 'card'],
  ['popover-fg', 'popover'], ['accent-soft-fg', 'accent-soft'], ['danger-fg', 'danger'], ['success-fg', 'success'],
  ['warning-fg', 'warning'], ['sidebar-fg', 'sidebar'], ['sidebar-accent-fg', 'sidebar-accent'],
]

const decl = (set: Record<string, string>, indent: string) => Object.entries(set).map(([k, v]) => `${indent}--ui-${k}: ${v};\n`).join('')
const under = (prefix: string, scope: string) => scope.split(',').map((s) => `${prefix} ${s.trim()}`).join(', ')

/** theme.css text: the light rule, the dark rule for the OS setting, and the dark rule for data-theme="dark". */
export function toCss(theme: Theme, scope = ':root'): string {
  const root = scope === ':root'
  const osDark = root ? ":root:not([data-theme='light'])" : under(":root:not([data-theme='light'])", scope)
  const toggleDark = root ? ":root[data-theme='dark']" : under(":root[data-theme='dark']", scope)
  const scale = `\n  /* Spacing: steps of --ui-space (4px), set in the same rule so changing the unit rescales them. */\n${SPACE_STEPS.map((n) => `  --ui-space-${n}: calc(var(--ui-space) * ${n});\n`).join('')}`
  return `${scope} {\n${decl(theme.light, '  ')}${scale}}\n@media (prefers-color-scheme: dark) {\n  ${osDark} {\n${decl(theme.dark, '    ')}  }\n}\n${toggleDark} {\n${decl(theme.dark, '  ')}}\n`
}

// sRGB hex ⇄ OKLCH (Björn Ottosson's OKLab), enough to flip lightness and keep hue.
const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const gam = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)
function toOklch(hex: string): [number, number, number] {
  const [r, g, b] = hex.slice(1).match(/../g)!.map((x) => lin(parseInt(x, 16) / 255)) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return [L, Math.hypot(A, B), Math.atan2(B, A)]
}
export function fromOklch([L, C, h]: [number, number, number]): string {
  const A = C * Math.cos(h), B = C * Math.sin(h)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
  return '#' + rgb.map((v) => Math.round(Math.min(1, Math.max(0, gam(v))) * 255).toString(16).padStart(2, '0')).join('')
}
const HEX = /^#[0-9a-f]{6}$/i
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const SURFACES = ['bg', 'card', 'popover', 'sidebar', 'accent-soft', 'secondary', 'muted-bg']
const LINES = ['border', 'input', 'sidebar-border']
const BRAND = ['accent', 'ring', 'danger', 'success', 'warning']

/** A dark set from a light one: surfaces and text swap lightness (hue kept); brand colours get light enough to read. */
export function darkFrom(light: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  const flip = (hex: string, lo: number, hi: number) => { const [L, C, h] = toOklch(hex); return fromOklch([clamp(1 - L, lo, hi), C, h]) }
  for (const [k, v] of Object.entries(light)) {
    if (MODELESS.includes(k)) continue
    if (k === 'shadow') out[k] = '0 8px 24px rgb(0 0 0 / 0.5)'
    else if (!HEX.test(v)) out[k] = v
    else if (SURFACES.includes(k)) out[k] = flip(v, 0.12, 0.3)
    else if (LINES.includes(k)) out[k] = flip(v, 0.3, 0.42)
    else if (BRAND.includes(k)) { const [L, C, h] = toOklch(v); out[k] = fromOklch([Math.max(L, 0.75), C, h]) }
    else if (k === 'muted') out[k] = flip(v, 0.72, 0.8)
    else out[k] = flip(v, 0.9, 0.97) // text: fg, card-fg, popover-fg, *-fg on surfaces
  }
  // Text on a brand colour turns dark once the brand colour is light.
  for (const k of ['accent-fg', 'danger-fg', 'success-fg', 'warning-fg']) if (k in out) out[k] = out.bg ?? '#0b1415'
  return out
}

const luminance = (hex: string) => {
  const [r, g, b] = hex.slice(1).match(/../g)!.map((x) => lin(parseInt(x, 16) / 255)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** WCAG contrast ratio of two #rrggbb colours (1 to 21). */
export function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [number, number]
  return (a + 0.05) / (b + 0.05)
}

// A link carries the preset and only the tokens that differ from it: base~l!name!value~d!name!value (values
// URI-encoded). Decoding accepts known names only, #rrggbb for colours, and no ; } or < anywhere.
export function encode(theme: Theme, name: string): string {
  const base: PresetName = Object.hasOwn(presets, name) ? (name as PresetName) : 'teal'
  const parts: string[] = [base]
  for (const [mode, m] of [['light', 'l'], ['dark', 'd']] as const) {
    for (const [k, v] of Object.entries(theme[mode])) if (presets[base][mode][k] !== v) parts.push(`${m}!${k}!${encodeURIComponent(v)}`)
  }
  return parts.join('~')
}

const PX = /^\d{1,2}px$/
/** A value the builder could have produced: a #rrggbb colour, or one of its font, size, radius or shadow options. */
function allowed(name: string, value: string, m: 'l' | 'd'): boolean {
  if (name === 'font') return FONTS.some((f) => f.value === value)
  if (name === 'font-heading') return HEADINGS.some((f) => f.value === value)
  if (name === 'font-mono') return MONOS.some((f) => f.value === value)
  if (name === 'font-size' || name === 'radius') return PX.test(value)
  if (name === 'space') return DENSITIES.some((d) => d.value === value)
  if (name === 'shadow') return Object.values(SHADOWS).some((pair) => pair[m === 'l' ? 0 : 1] === value)
  return HEX.test(value)
}

/** After decoding: which shadow choice the theme holds, and which dark tokens were set by hand (kept on light edits). */
export function restore(theme: Theme, base: string = 'teal'): { shadow: keyof typeof SHADOWS; edited: string[] } {
  const preset = presets[(Object.hasOwn(presets, base) ? base : 'teal') as PresetName]
  const shadow = (Object.keys(SHADOWS) as (keyof typeof SHADOWS)[]).find((k) => SHADOWS[k][0] === theme.light.shadow && SHADOWS[k][1] === theme.dark.shadow) ?? 'soft'
  const generated = darkFrom(theme.light)
  const edited = Object.keys(theme.dark).filter((k) => k !== 'shadow' && theme.dark[k] !== preset.dark[k] && theme.dark[k] !== generated[k])
  return { shadow, edited }
}

export function decode(text: string): { base: PresetName; theme: Theme } | null {
  const [base, ...entries] = text.split('~')
  if (!base || !Object.hasOwn(presets, base)) return null
  const preset = presets[base as PresetName]
  const theme: Theme = { light: { ...preset.light }, dark: { ...preset.dark } }
  for (const entry of entries) {
    const [m, name, raw] = entry.split('!')
    if ((m !== 'l' && m !== 'd') || !name || raw === undefined || !(TOKEN_NAMES as readonly string[]).includes(name)) return null
    let value: string
    try { value = decodeURIComponent(raw) } catch { return null }
    if (m === 'd' && MODELESS.includes(name)) return null
    if (!allowed(name, value, m)) return null
    theme[m === 'l' ? 'light' : 'dark'][name] = value
  }
  return { base: base as PresetName, theme }
}
