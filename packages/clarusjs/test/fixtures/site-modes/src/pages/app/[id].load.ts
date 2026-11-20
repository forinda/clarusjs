export function entries() {
  return [{ id: 'one' }, { id: 'two' }]
}
export function load({ params }: { params: Record<string, string> }) {
  return { label: `Item ${params.id}` }
}
