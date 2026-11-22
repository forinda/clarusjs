// Package-manager commands for the docs: one neutral command, written the way each manager spells it.

export const managers = ['pnpm', 'npm', 'yarn', 'bun'] as const
export type Manager = (typeof managers)[number]

/**
 * 'add x' · 'add -D x' · 'run script' · 'exec bin' · 'create x' · 'init' (a package.json, no questions) · 'sh line'
 * (a shell line, the same for every manager). Anything after two spaces and '#' is kept as a
 * comment. Unknown verbs pass through unchanged after the manager's name.
 */
export function command(manager: Manager, neutral: string): string {
  const [cmd = '', note] = neutral.split(/\s{2,}(?=#)/)
  const [verb = '', ...rest] = cmd.trim().split(/\s+/)
  const dev = rest[0] === '-D'
  const args = (dev ? rest.slice(1) : rest).join(' ')
  let out: string
  if (verb === 'sh') {
    out = cmd.trim().slice(3)
  } else if (verb === 'init') {
    out = manager === 'pnpm' ? 'pnpm init' : `${manager} init -y`
  } else if (verb === 'add') {
    const flag = dev ? (manager === 'bun' ? ' -d' : ' -D') : ''
    out = `${manager === 'npm' ? 'npm install' : `${manager} add`}${flag} ${args}`
  } else if (verb === 'run') {
    out = manager === 'yarn' ? `yarn ${args}` : `${manager} run ${args}`
  } else if (verb === 'exec') {
    out = { pnpm: `pnpm exec ${args}`, npm: `npx ${args}`, yarn: `yarn ${args}`, bun: `bunx ${args}` }[manager]
  } else {
    out = `${manager} ${cmd.trim()}`
  }
  return note ? `${out}  ${note}` : out
}
