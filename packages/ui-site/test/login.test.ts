// The login block's rules: what the page shows before calling the handler.
import { expect, test } from 'vitest'
import { signIn, validateLogin } from '../src/registry/blocks/login/data.ts'

test('validateLogin: an email with an @, and a password of 8 or more', () => {
  expect(validateLogin({ email: '', password: '' })).toEqual({ email: 'Enter your email address.', password: 'Use at least 8 characters.' })
  expect(validateLogin({ email: 'ada', password: '1234567' })).toEqual({ email: 'Enter your email address.', password: 'Use at least 8 characters.' })
  expect(validateLogin({ email: ' ada@example.com ', password: '12345678' })).toEqual({})
})

test('signIn (the stub to replace): answers who signed in, or an error for its field; a signal cancels it', async () => {
  expect(await signIn({ email: ' ada@example.com ', password: '12345678' })).toEqual({ user: 'ada@example.com' })
  expect(await signIn({ email: 'taken@example.com', password: '12345678' })).toEqual({ errors: { password: 'Wrong email or password.' } })
  const controller = new AbortController()
  const call = signIn({ email: 'ada@example.com', password: '12345678' }, { signal: controller.signal })
  controller.abort()
  await expect(call).rejects.toThrow()
  // A signal already aborted rejects at once, without waiting.
  const early = new AbortController()
  early.abort()
  await expect(signIn({ email: 'ada@example.com', password: '12345678' }, { signal: early.signal })).rejects.toThrow()
})
