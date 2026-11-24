// What the builder offers for the tokens that aren't colours. Links and saved themes are checked against these.
import { presets } from './presets.ts'

export type Option = { label: string; value: string; google?: string }
export const FONTS: Option[] = [
  { label: 'System', value: 'system-ui, sans-serif' },
  { label: 'Inter', value: "'Inter', system-ui, sans-serif", google: 'Inter' },
  { label: 'Geist', value: "'Geist', system-ui, sans-serif", google: 'Geist' },
  { label: 'Lora', value: "'Lora', Georgia, serif", google: 'Lora' },
  { label: 'Georgia', value: 'Georgia, serif' },
]
export const HEADINGS: Option[] = [{ label: 'Same as body', value: 'var(--ui-font)' }, ...FONTS]
export const MONOS: Option[] = [
  { label: 'System mono', value: 'ui-monospace, monospace' },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', ui-monospace, monospace", google: 'JetBrains Mono' },
]
export const SIZES = ['13px', '14px', '15px', '16px', '18px']
/** [light, dark] shadow per choice. */
export const SHADOWS: Record<'none' | 'soft' | 'strong', [string, string]> = {
  none: ['none', 'none'],
  soft: [presets.teal.light.shadow!, presets.teal.dark.shadow!],
  strong: ['0 16px 40px rgb(0 0 0 / 0.28)', '0 16px 40px rgb(0 0 0 / 0.7)'],
}
