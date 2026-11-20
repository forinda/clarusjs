export function entries() {
  return [{ id: 'ada' }, { id: 'linus' }]
}

export async function load({ params }: { params: Record<string, string> }) {
  return { name: params.id!.charAt(0).toUpperCase() + params.id!.slice(1) }
}
