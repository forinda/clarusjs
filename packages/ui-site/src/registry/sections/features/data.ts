// The features sections' words, icons and links: change them to yours. Every version reads the same ones.
export const features = {
  eyebrow: 'Why Lumen',
  title: 'Everything you need to ship, nothing to set up',
  line: 'Push to git and the rest happens: builds, previews, hosting and the numbers that tell you it works.',
}

/** Icons as SVG paths (a 24-unit box, drawn as lines): swap in your own. */
export const items: { title: string; text: string; href: string; icon: string }[] = [
  { title: 'Previews for every branch', text: 'Each push gets its own link to share, with comments on the page itself.', href: '#previews', icon: 'M3 12h4l3-8 4 16 3-8h4' },
  { title: 'Fast everywhere', text: 'Pages are served from the region closest to whoever asks for them.', href: '#network', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18' },
  { title: 'Rollbacks in a click', text: 'Every deploy is kept: put any one back live while you fix the next.', href: '#rollbacks', icon: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4' },
  { title: 'Built-in analytics', text: 'See which pages are slow and who they’re slow for, without a script.', href: '#analytics', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { title: 'Secrets kept secret', text: 'Environment variables per branch, encrypted, never in your logs.', href: '#secrets', icon: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z' },
  { title: 'Your stack, as it is', text: 'Any framework that builds to files or a server runs as it does locally.', href: '#frameworks', icon: 'M8 6 2 12l6 6M16 6l6 6-6 6' },
]

/** The bento grid's numbers for its chart card: a week of visits. */
export const week = [32, 41, 38, 52, 47, 61, 58]
