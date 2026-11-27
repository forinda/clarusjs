// GET /api/cities?q=…: the cities whose name contains the search, as [{ value, label }], for the combobox's remote
// example. A plain fetch handler: a Netlify Function on the site (netlify/functions/cities.ts), and the same function
// in `vite` and `vite preview` (vite.config.ts).
const CITIES = ['Amsterdam', 'Athens', 'Bangkok', 'Berlin', 'Bogotá', 'Buenos Aires', 'Cairo', 'Cape Town', 'Dublin', 'Hanoi', 'Helsinki', 'Istanbul', 'Jakarta', 'Kyoto', 'Lagos', 'Lima', 'Lisbon', 'London', 'Madrid', 'Melbourne', 'Mexico City', 'Montréal', 'Mumbai', 'Nairobi', 'Oslo', 'Paris', 'Prague', 'Reykjavík', 'Rome', 'Santiago', 'Seoul', 'Stockholm', 'Sydney', 'Tokyo', 'Toronto', 'Vienna', 'Warsaw', 'Zürich']

export default function cities(request: Request): Response {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().toLowerCase()
  const found = CITIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 8)
  return Response.json(found.map((c) => ({ value: c.toLowerCase().replace(/\s+/g, '-'), label: c })))
}
