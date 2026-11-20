// Island props and state go from server HTML to the browser as JSON, with tags for what JSON can't hold.
// Shared by the server (stringify) and the browser (parse).

const TAG = '$cl'
type Tagged = { [TAG]: string; v?: unknown }

/**
 * JSON plus Date, Map, Set, undefined, NaN, ±Infinity, -0 and BigInt. Objects that themselves have a `$cl` key are
 * wrapped so data is never mistaken for a tag. Functions, symbols, class instances and cycles are rejected with the
 * path to the bad value.
 */
export function stringify(value: unknown): string {
  return JSON.stringify(encode(value, '', new Set()))
}

function encode(value: unknown, path: string, seen: Set<object>): unknown {
  const at = (key: string | number) => (path ? `${path}.${key}` : String(key))
  const fail = (what: string): never => {
    throw new TypeError(`[clarusjs] cannot send ${path || 'the value'} to the browser: ${what}`)
  }
  switch (typeof value) {
    case 'undefined':
      return { [TAG]: 'u' }
    case 'number':
      if (Number.isFinite(value) && !Object.is(value, -0)) return value
      return { [TAG]: 'n', v: Object.is(value, -0) ? '-0' : String(value) }
    case 'bigint':
      return { [TAG]: 'b', v: value.toString() }
    case 'function':
    case 'symbol':
      return fail(`it is a ${typeof value}`)
    case 'object': {
      if (value === null) return null
      if (seen.has(value)) return fail('circular reference')
      seen.add(value)
      try {
        if (Array.isArray(value)) {
          const out: unknown[] = []
          for (let i = 0; i < value.length; i++) out.push(encode(value[i], at(i), seen))
          return out
        }
        if (value instanceof Date) return { [TAG]: 'd', v: Number.isNaN(value.getTime()) ? null : value.toISOString() }
        if (value instanceof Map) return { [TAG]: 'm', v: [...value].map(([k, v], i) => [encode(k, at(`key${i}`), seen), encode(v, at(i), seen)]) }
        if (value instanceof Set) return { [TAG]: 's', v: [...value].map((v, i) => encode(v, at(i), seen)) }
        const proto = Object.getPrototypeOf(value)
        if (proto !== Object.prototype && proto !== null) {
          return fail(`it is a ${proto?.constructor?.name ?? 'class instance'}; only plain objects, arrays, Date, Map and Set can be sent`)
        }
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value)) out[k] = encode(v, at(k), seen)
        return TAG in out ? { [TAG]: 'o', v: out } : out
      } finally {
        seen.delete(value)
      }
    }
    default:
      return value // string, boolean
  }
}

/** The inverse of stringify(). */
export function parse(text: string): unknown {
  return decode(JSON.parse(text))
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode)
  if (value === null || typeof value !== 'object') return value
  if (TAG in value) {
    const { [TAG]: tag, v } = value as Tagged
    switch (tag) {
      case 'u': return undefined
      case 'n': return v === '-0' ? -0 : Number(v)
      case 'b': return BigInt(v as string)
      case 'd': return new Date(v === null ? NaN : (v as string))
      case 'm': return new Map((v as [unknown, unknown][]).map(([k, x]) => [decode(k), decode(x)]))
      case 's': return new Set((v as unknown[]).map(decode))
      case 'o': return decodeObject(v as Record<string, unknown>)
    }
  }
  return decodeObject(value as Record<string, unknown>)
}

function decodeObject(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) out[k] = decode(v)
  return out
}
