// A health endpoint for an orchestrator (Kubernetes, ECS) that wants one; the image's HEALTHCHECK asks / itself.
export function GET(): Response {
  return new Response('ok')
}
