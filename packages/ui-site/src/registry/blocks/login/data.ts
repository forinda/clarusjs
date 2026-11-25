// The login block's data: its rules and the call it makes. Replace signIn with your own (a request() to your API,
// passing the signal on, or your auth library); keep its answer's shape so errors land on their fields. The page
// runs it as an action() from clarusjs/fetch: pending while it runs, no double submit, an alert if it throws.

export type Credentials = { email: string; password: string }
export type LoginErrors = Partial<Record<keyof Credentials, string>>

/** What the page checks before calling signIn: an empty object when all is well. */
export function validateLogin(values: Credentials): LoginErrors {
  const errors: LoginErrors = {}
  if (!values.email.trim().includes('@')) errors.email = 'Enter your email address.'
  if (values.password.length < 8) errors.password = 'Use at least 8 characters.'
  return errors
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => (clearTimeout(timer), reject(signal.reason)), { once: true })
  })

/**
 * Signs in: who did, or errors for their fields. The stub waits a moment and accepts everyone but
 * taken@example.com (an error on the password) and offline@example.com (a failed call): replace it with your own,
 * for example `request('/api/login', { method: 'POST', body: values, signal })`.
 */
export async function signIn(values: Credentials, { signal }: { signal?: AbortSignal } = {}): Promise<{ user?: string; errors?: LoginErrors }> {
  await wait(300, signal)
  const email = values.email.trim()
  if (email === 'offline@example.com') throw new Error('The server could not be reached.')
  if (email === 'taken@example.com') return { errors: { password: 'Wrong email or password.' } }
  return { user: email }
}
