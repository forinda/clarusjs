// The form validation guide's demo: a Standard Schema written by hand (Zod, Valibot or ArkType would do the same in a
// few lines; the docs site keeps no dependency for it), an async check, and a pretend server.
import type { StandardSchema } from 'clarusjs/forms'

export type Signup = { name: string; email: string; username: string; plan: string; terms: boolean }

const TAKEN = ['admin', 'clarus', 'root']
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Rules beyond the fields' own (required, type="email"): the username's form, and whether it's free (async). */
export const signupSchema: StandardSchema<Signup> = {
  '~standard': {
    version: 1,
    vendor: 'clarusjs-docs',
    async validate(value) {
      const v = value as Signup
      const issues: { message: string; path: string[] }[] = []
      if (v.username && !/^[a-z0-9-]{3,}$/.test(v.username)) issues.push({ message: 'Use 3 or more lowercase letters, digits or dashes.', path: ['username'] })
      else if (v.username) {
        await wait(150) // as if asking a server
        if (TAKEN.includes(v.username)) issues.push({ message: 'That username is taken.', path: ['username'] })
      }
      return issues.length ? { issues } : { value: v }
    },
  },
}

/** The pretend server: one email is already registered. */
export async function register(values: Signup): Promise<{ errors?: Record<string, string> }> {
  await wait(150)
  return values.email === 'taken@example.com' ? { errors: { email: 'That email is already registered.' } } : {}
}
