// The client-route tour: three short steps, rendered in the browser from their __data.json.
export type Step = { n: number; title: string; text: string }

export const steps: Step[] = [
  { n: 1, title: 'A shell arrives', text: 'The first request for a client route returns a small shell: the island loader, the router and a table of the client routes. Nothing of this page was in it.' },
  { n: 2, title: 'The router renders', text: 'The router fetched this step’s __data.json, built at deploy time by load(), and rendered the page with the same template the server would use.' },
  { n: 3, title: 'No reload', text: 'Moving between steps never reloaded the page: the Navigation API hands each click to the router. Browsers without it simply load each step normally.' },
]
