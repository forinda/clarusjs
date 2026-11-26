// The newsletter section's words, and the call it makes: replace subscribe with your own. It gets the email and
// returns { error } to show on the field, or {} when it worked.
export const newsletter = {
  title: 'Hear what ships next',
  line: 'One email a month: new features, and how teams use them. No spam.',
  label: 'Email',
  button: 'Subscribe',
  thanks: 'Thanks: check your inbox to confirm.',
}

export async function subscribe(email: string): Promise<{ error?: string }> {
  await new Promise((r) => setTimeout(r, 300)) // where your API call goes
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter an email address like you@company.com.' }
  return {}
}
