// The footer sections' brand, status, links and the theme switch's call: change them to yours.
export const brand = { name: 'Lumen', href: '/', copyright: '© 2026 Lumen, Inc.' }
/** The status line: point href at your status page. */
export const status = { label: 'All systems normal', href: '#status' }
export const columns: { title: string; links: { label: string; href: string }[] }[] = [
  { title: 'Product', links: [{ label: 'Hosting', href: '#hosting' }, { label: 'Previews', href: '#previews' }, { label: 'Analytics', href: '#analytics' }, { label: 'Pricing', href: '#pricing' }] },
  { title: 'Resources', links: [{ label: 'Docs', href: '#docs' }, { label: 'Guides', href: '#guides' }, { label: 'Changelog', href: '#changelog' }] },
  { title: 'Company', links: [{ label: 'About', href: '#about' }, { label: 'Blog', href: '#blog' }, { label: 'Careers', href: '#careers' }] },
  { title: 'Legal', links: [{ label: 'Privacy', href: '#privacy' }, { label: 'Terms', href: '#terms' }] },
]

export type ThemeMode = 'light' | 'dark' | 'system'
/** Called by the theme switch: replace it with your site's own (this one sets data-theme on <html>, as theme.css reads it). */
export function setTheme(mode: ThemeMode): void {
  if (mode === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', mode)
}
