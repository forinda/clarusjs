import { steps } from '~/tour.ts'

export function entries() {
  return steps.map((s) => ({ step: String(s.n) }))
}

/** Runs at build; the router fetches the result as /tour/<step>/__data.json. */
export function load({ params }: { params: { step: string } }) {
  const n = Number(params.step)
  return { current: steps[n - 1]!, total: steps.length }
}
