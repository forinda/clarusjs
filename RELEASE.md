# Releasing

clarusjs is versioned with [Changesets](https://github.com/changesets/changesets) and published to npm from GitHub
Actions with [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC, no `NPM_TOKEN`). Nobody runs
`npm publish` by hand.

## In a pull request

If the change affects a published package, add a changeset:

```sh
pnpm changeset          # pick packages, pick patch / minor / major, write the changelog entry
pnpm changeset:status   # see pending changesets and the versions they will produce
```

Commit the generated `.changeset/*.md` file with the change. Docs-, test- and CI-only changes don't need one.

## What happens on main

`.github/workflows/release.yml` runs on every push to `main`:

1. **Changesets are pending:** it opens or updates a **"chore: version packages"** pull request that bumps versions,
   writes each package's `CHANGELOG.md` (with PR and author links) and deletes the consumed changesets.
2. **That pull request is merged:** the next run builds the packages (`dist/` with JS and `.d.ts`), publishes them to
   npm with signed provenance, pushes git tags and creates GitHub releases.

So releasing is: review the "version packages" pull request, then merge it.

## Trusted publishing

Each published package needs a trusted-publisher rule on npm (done for `clarusjs`):
npmjs.com → package → **Settings** → **Trusted publishers** → GitHub Actions, repository `forinda/clarusjs`, workflow
`.github/workflows/release.yml`, no environment. A new package needs the same rule before its first automated publish.

## What gets published

The repo's `exports` point at `src/*.ts` so the workspace and tests run from source. `publishConfig.exports` in
`packages/clarusjs/package.json` points at `dist/`, and pnpm swaps it in when packing, so the published package only
contains compiled JS and type declarations. `prepublishOnly` builds first. `test/dist.test.ts` checks the built output.

To inspect a release locally without publishing:

```sh
pnpm --filter clarusjs build
pnpm --filter clarusjs pack --pack-destination /tmp
```

## Pre-releases

```sh
pnpm release:enter:alpha   # or :beta, :rc — following versions become 0.x.y-alpha.N
pnpm release:exit:pre      # back to normal releases
```

Commit the `.changeset/pre.json` the first command creates. While it exists, the release workflow publishes
pre-release versions under the matching npm dist-tag.

## If a publish fails

Re-run the **Release** workflow from the Actions tab (it has a manual trigger). Packages already published at the
target version are skipped.

Running `pnpm changeset:version` locally needs a `GITHUB_TOKEN` in the environment, because the changelog generator
looks up pull requests on GitHub. CI provides one automatically.
