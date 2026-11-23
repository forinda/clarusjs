// The Forms guide's remote combobox (an endpoint): ?q= answers the cities whose name contains it, as
// [{ value, label }], at most 8. Slowed a little, so the debounce and "Searching…" show.
import type { RequestHandler } from 'clarusjs/server'

const CITIES = ['Accra', 'Addis Ababa', 'Algiers', 'Amsterdam', 'Athens', 'Bangkok', 'Barcelona', 'Beijing', 'Berlin', 'Bogotá', 'Buenos Aires', 'Cairo', 'Cape Town', 'Casablanca', 'Dakar', 'Dar es Salaam', 'Delhi', 'Dubai', 'Dublin', 'Durban', 'Helsinki', 'Istanbul', 'Jakarta', 'Johannesburg', 'Kampala', 'Kigali', 'Kinshasa', 'Kyoto', 'Lagos', 'Lima', 'Lisbon', 'London', 'Luanda', 'Lusaka', 'Madrid', 'Manila', 'Mexico City', 'Mombasa', 'Montréal', 'Mumbai', 'Nairobi', 'Oslo', 'Paris', 'Rome', 'Santiago', 'São Paulo', 'Seoul', 'Singapore', 'Stockholm', 'Sydney', 'Tokyo', 'Toronto', 'Tunis', 'Vienna', 'Windhoek', 'Zanzibar']
const slug = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '-')

export const GET: RequestHandler = async ({ request }) => {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 40)
  await new Promise((done) => setTimeout(done, 250))
  const matches = CITIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 8)
  return Response.json(matches.map((c) => ({ value: slug(c), label: c })), { headers: { 'cache-control': 'no-store' } })
}
