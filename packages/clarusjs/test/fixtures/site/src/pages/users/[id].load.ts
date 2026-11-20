export function entries() {
  return [{ id: 'ada' }, { id: 'linus' }, { id: 'grace hopper' }]
}

export async function load({ params }: { params: Record<string, string> }) {
  return { name: params.id!.charAt(0).toUpperCase() + params.id!.slice(1) }
}
