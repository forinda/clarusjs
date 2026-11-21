// The Fetching guide's dashboard data, shared by its islands: one batch for the stat cards (one request for all of
// them), and the signed-in user, fetched once for the page (the user panel shows it, the activity feed waits on it).
import { batch, json, resource } from 'clarusjs/fetch'

export type User = { id: number; name: string; role: string }

export const stats = batch<number>((keys, { signal }) => json(`/api/demo-stats?keys=${keys.join(',')}`, { signal }))

export const user = resource(({ signal }) => json<{ user: User }>('/api/demo-stats?keys=user', { signal }).then((r) => r.user))
