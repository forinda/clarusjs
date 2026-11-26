// The pricing sections' plans and what each includes: change them to yours. Prices are per month, in dollars; null is
// "Custom". Yearly prices are what a month costs when paid for a year.
export const pricing = {
  title: 'A plan for every stage',
  line: 'Start free. Pay when your team and your traffic grow.',
  yearly: 'Billed yearly',
}

export type Plan = { name: string; monthly: number | null; yearly: number | null; line: string; inherits?: string; features: string[]; popular?: boolean; cta: { label: string; href: string } }

export const plans: Plan[] = [
  { name: 'Hobby', monthly: 0, yearly: 0, line: 'For personal projects and trying things out.', features: ['Deploys from git', 'Previews for every branch', 'HTTPS on your domain', 'Community support'], cta: { label: 'Start free', href: '#hobby' } },
  { name: 'Pro', monthly: 24, yearly: 20, line: 'For teams shipping to real users.', inherits: 'Hobby', features: ['Comments on previews', 'Analytics per page', 'Rollbacks in a click', 'Email support'], popular: true, cta: { label: 'Start a free trial', href: '#pro' } },
  { name: 'Enterprise', monthly: null, yearly: null, line: 'For security reviews and an SLA.', inherits: 'Pro', features: ['Single sign-on', 'Audit logs', '99.99% uptime SLA', 'A named engineer'], cta: { label: 'Talk to us', href: '#enterprise' } },
]

/** The comparison table: true is included, false is not, a string says how much. One value per plan, in order. */
export const comparison: { group: string; rows: { label: string; values: (boolean | string)[] }[] }[] = [
  { group: 'Deploys', rows: [
    { label: 'Deploys from git', values: [true, true, true] },
    { label: 'Previews for every branch', values: [true, true, true] },
    { label: 'Comments on previews', values: [false, true, true] },
    { label: 'Build minutes a month', values: ['100', '6,000', 'Custom'] },
  ] },
  { group: 'Security', rows: [
    { label: 'HTTPS on your domain', values: [true, true, true] },
    { label: 'Single sign-on', values: [false, false, true] },
    { label: 'Audit logs', values: [false, false, true] },
  ] },
]
