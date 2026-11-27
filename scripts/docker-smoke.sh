#!/bin/sh
# #601: builds examples/docker's image with this checkout's clarusjs (packed, as npm would install it) and checks
# the container: a built page, a server route, an endpoint, the headers, the 404 page, its health check, and that
# it stops cleanly on SIGTERM. Run from the repo root after pnpm install: sh scripts/docker-smoke.sh
set -eu
pnpm --filter clarusjs build >/dev/null
dir=$(mktemp -d)
cp -r examples/docker/. "$dir"
(cd packages/clarusjs && pnpm pack --pack-destination "$dir" >/dev/null)
tgz=$(basename "$dir"/clarusjs-*.tgz)
# The one change from the example as published: clarusjs from the tarball, copied in before npm ci.
node -e "const f='$dir/package.json',p=JSON.parse(require('fs').readFileSync(f));p.dependencies.clarusjs='file:./$tgz';require('fs').writeFileSync(f,JSON.stringify(p,null,2))"
sed -i "s|^COPY package.json package-lock.json ./|COPY package.json package-lock.json $tgz ./|" "$dir/Dockerfile"
(cd "$dir" && npm install --package-lock-only --no-audit --no-fund >/dev/null)
docker build -q -t clarusjs-docker-smoke "$dir" >/dev/null
id=$(docker run -d -p 127.0.0.1:3999:3000 clarusjs-docker-smoke)
trap 'docker rm -f "$id" >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 50); do curl -sf http://127.0.0.1:3999/ >/dev/null && break; sleep 0.2; done

fail() { echo "docker smoke: $1" >&2; docker logs "$id" >&2; exit 1; }
curl -sf http://127.0.0.1:3999/ | grep -q 'Served from a container' || fail 'no built page at /'
curl -sf http://127.0.0.1:3999/now | grep -q 'Rendered at 20' || fail 'no server route at /now'
[ "$(curl -sf http://127.0.0.1:3999/api/health)" = ok ] || fail 'no endpoint at /api/health'
curl -sI http://127.0.0.1:3999/ | grep -qi '^x-content-type-options: nosniff' || fail 'no _headers headers'
[ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3999/missing)" = 404 ] || fail '/missing is not a 404'
# The image's HEALTHCHECK command, run now rather than after its first interval.
docker exec "$id" node -e "fetch('http://127.0.0.1:3000/').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))" || fail 'health check failed'
# SIGTERM: in-flight requests finish, then it exits 0 (not killed after docker's 10 s).
docker stop -t 5 "$id" >/dev/null
[ "$(docker inspect -f '{{.State.ExitCode}}' "$id")" = 0 ] || fail 'did not exit cleanly on SIGTERM'
echo 'docker smoke: ok'
