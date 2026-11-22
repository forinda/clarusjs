// Share links: the source in the URL hash, deflated and base64url-encoded (no server involved).
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

const pipe = async (bytes: Uint8Array, stream: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer())

/** `source` as a URL-safe hash. */
export async function encode(source: string): Promise<string> {
  const bytes = await pipe(new TextEncoder().encode(source), new CompressionStream('deflate-raw'))
  let s = ''
  // In chunks (a long source would overflow the call stack), of a multiple of 3 bytes so the base64 pieces join up.
  for (let i = 0; i < bytes.length; i += 32766) s += b64url(bytes.subarray(i, i + 32766))
  return s
}

// A shared component is small: a longer hash, or one inflating past this, isn't one (a decompression bomb, say).
const MAX_HASH = 200_000
const MAX_SOURCE = 256 * 1024

/** The source a hash holds, or undefined for anything it can't read. */
export async function decode(hash: string): Promise<string | undefined> {
  if (!hash || hash.length > MAX_HASH || !/^[A-Za-z0-9_-]+$/.test(hash)) return undefined
  try {
    // Read the inflated bytes with a budget, stopping as soon as it's exceeded.
    const reader = new Blob([unb64url(hash) as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > MAX_SOURCE) {
        await reader.cancel()
        return undefined
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let at = 0
    for (const c of chunks) { bytes.set(c, at); at += c.length }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return undefined
  }
}
