// The header sections' brand, links and actions: change them to yours. Every version reads the same ones.
export const brand = { name: 'Lumen', href: '/' }
/** Links in the bar, in order. */
export const links: { label: string; href: string }[] = [
  { label: 'Pricing', href: '#pricing' },
  { label: 'Docs', href: '#docs' },
  { label: 'Blog', href: '#blog' },
]
/** The Products menu's items: each goes to its href when chosen. */
export const products: { label: string; href: string }[] = [
  { label: 'Hosting', href: '#hosting' },
  { label: 'Previews', href: '#previews' },
  { label: 'Analytics', href: '#analytics' },
]
export const actions = { login: { label: 'Log in', href: '#login' }, signup: { label: 'Sign up', href: '#signup' } }
