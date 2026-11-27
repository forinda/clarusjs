#!/bin/sh
# #601: builds examples/docker's images with this checkout's clarusjs (packed, as a registry would serve it) and checks
# each container: a built page, a server route, an endpoint, the headers, the 404 page, its health check, and that it
# stops cleanly on SIGTERM. Three images: npm (Dockerfile), pnpm (Dockerfile.pnpm), and a pnpm workspace with
# `pnpm deploy` (Dockerfile.pnpm-monorepo). Run from the repo root after pnpm install: sh scripts/docker-smoke.sh
set -eu
pnpm --filter clarusjs build >/dev/null
work=$(mktemp -d)
(cd packages/clarusjs && pnpm pack --pack-destination "$work" >/dev/null)
tgz=$(basename "$work"/clarusjs-*.tgz)
pm="pnpm@$(pnpm --version)"
ids=""
trap 'for id in $ids; do docker rm -f "$id" >/dev/null 2>&1 || true; done' EXIT

# package.json edits: clarusjs from the tarball (or the workspace), the pnpm version for corepack, the package's name.
edit() { node -e "const f=process.argv[1],p=JSON.parse(require('fs').readFileSync(f));Object.assign(p,JSON.parse(process.argv[2]));p.dependencies.clarusjs=process.argv[3];require('fs').writeFileSync(f,JSON.stringify(p,null,2))" "$@"; }

check() { # image port
  id=$(docker run -d -p "127.0.0.1:$2:3000" "$1"); ids="$ids $id"
  url="http://127.0.0.1:$2"
  for _ in $(seq 1 50); do curl -sf "$url/" >/dev/null && break; sleep 0.2; done
  fail() { echo "docker smoke ($1): $2" >&2; docker logs "$id" >&2; exit 1; }
  curl -sf "$url/" | grep -q 'Served from a container' || fail "$1" 'no built page at /'
  curl -sf "$url/now" | grep -q 'Rendered at 20' || fail "$1" 'no server route at /now'
  [ "$(curl -sf "$url/api/health")" = ok ] || fail "$1" 'no endpoint at /api/health'
  curl -sI "$url/" | grep -qi '^x-content-type-options: nosniff' || fail "$1" 'no _headers headers'
  [ "$(curl -s -o /dev/null -w '%{http_code}' "$url/missing")" = 404 ] || fail "$1" '/missing is not a 404'
  # The image's HEALTHCHECK command, run now rather than after its first interval.
  docker exec "$id" node -e "fetch('http://127.0.0.1:3000/').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))" || fail "$1" 'health check failed'
  # SIGTERM: in-flight requests finish, then it exits 0 (not killed after docker's 10 s).
  docker stop -t 5 "$id" >/dev/null
  [ "$(docker inspect -f '{{.State.ExitCode}}' "$id")" = 0 ] || fail "$1" 'did not exit cleanly on SIGTERM'
  echo "docker smoke ($1): ok"
}

# npm: the one change from the example as published is clarusjs from the tarball, copied in before npm ci.
npm_dir="$work/npm"; cp -r examples/docker/. "$npm_dir"; cp "$work/$tgz" "$npm_dir"
edit "$npm_dir/package.json" '{}' "file:./$tgz"
sed -i "s|^COPY package.json package-lock.json ./|COPY package.json package-lock.json $tgz ./|" "$npm_dir/Dockerfile"
(cd "$npm_dir" && npm install --package-lock-only --no-audit --no-fund >/dev/null)
docker build -q -t clarusjs-smoke-npm "$npm_dir" >/dev/null
check clarusjs-smoke-npm 3999

# pnpm: the same, with pnpm-lock.yaml and the pnpm version corepack installs.
pnpm_dir="$work/pnpm"; cp -r examples/docker/. "$pnpm_dir"; cp "$work/$tgz" "$pnpm_dir"
edit "$pnpm_dir/package.json" "{\"packageManager\":\"$pm\"}" "file:./$tgz"
sed -i "s|^COPY package.json pnpm-lock.yaml ./|COPY package.json pnpm-lock.yaml $tgz ./|" "$pnpm_dir/Dockerfile.pnpm"
(cd "$pnpm_dir" && pnpm install --lockfile-only --ignore-workspace >/dev/null)
docker build -q -f "$pnpm_dir/Dockerfile.pnpm" -t clarusjs-smoke-pnpm "$pnpm_dir" >/dev/null
check clarusjs-smoke-pnpm 3998

# A pnpm workspace: clarusjs as a workspace package (the tarball's contents), the example as apps/my-site.
repo="$work/monorepo"; mkdir -p "$repo/apps" "$repo/packages/clarusjs"
tar -xzf "$work/$tgz" -C "$repo/packages/clarusjs" --strip-components=1
# As a registry install has it, already built: no dev dependencies (a workspace package would get them installed),
# and no scripts (its build runs from this repo's sources).
node -e "const f=process.argv[1],p=JSON.parse(require('fs').readFileSync(f));delete p.devDependencies;delete p.scripts;require('fs').writeFileSync(f,JSON.stringify(p,null,2))" "$repo/packages/clarusjs/package.json"
cp -r examples/docker/. "$repo/apps/my-site"
edit "$repo/apps/my-site/package.json" '{"name":"my-site"}' 'workspace:*'
printf '{ "name": "my-repo", "private": true, "packageManager": "%s" }\n' "$pm" > "$repo/package.json"
printf 'packages:\n  - apps/*\n  - packages/*\ninjectWorkspacePackages: true\n' > "$repo/pnpm-workspace.yaml"
printf 'node_modules\n**/node_modules\napps/*/dist\n.git\n' > "$repo/.dockerignore"
(cd "$repo" && pnpm install --lockfile-only >/dev/null)
docker build -q -f "$repo/apps/my-site/Dockerfile.pnpm-monorepo" -t clarusjs-smoke-monorepo "$repo" >/dev/null
check clarusjs-smoke-monorepo 3997
