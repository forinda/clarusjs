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

## VS Code extension

`packages/vscode` (`clarusjs-vscode`, publisher `forinda`: `forinda.clarusjs-vscode` on the Marketplace) is private to the workspace: it has no changesets, and the release workflow doesn't touch it. It's versioned and published by hand. The extension bundles the language server (`@clarusjs/language-server`, which bundles the `clarusjs` compiler), so changes to either reach VS Code only with the extension's next release: release the extension after a release that changes them. Type checking inside templates comes from the `clarusjs` package (the content mapper), released as usual.

1. **Changelog and version**, in a PR named `chore(vscode): release X.Y.Z`:
   - add `## X.Y.Z` at the top of `packages/vscode/CHANGELOG.md`, written for users like the entries below it;
   - set `"version"` in `packages/vscode/package.json`.

   A new feature is a minor bump, a fix a patch. Commits since the last release: `git log --oneline <last release commit>.. -- packages/vscode`.

2. **Package**, after the PR merges:

   ```bash
   git checkout main && git pull
   pnpm install
   pnpm --filter clarusjs-vscode package   # → packages/vscode/clarusjs-vscode-X.Y.Z.vsix
   ```

   `.vsix` files are git-ignored. To see what goes in: `cd packages/vscode && npx vsce ls --no-dependencies`.

3. **Try it**: `code --install-extension packages/vscode/clarusjs-vscode-X.Y.Z.vsix`, reload the window, then open a `.tscl` file: highlighting, a template error shown as you type, hover and completion on a component tag, a snippet such as `island`.

4. **Publish**, either:
   - from the CLI, with an Azure DevOps personal access token that has **Marketplace → Manage** scope for the `forinda` publisher:

     ```bash
     cd packages/vscode
     npx vsce login forinda    # once per machine; asks for the token
     npx vsce publish --packagePath clarusjs-vscode-X.Y.Z.vsix
     ```

   - or in the browser: at marketplace.visualstudio.com/manage/publishers/forinda, open the `clarusjs-vscode` row's **⋯** menu → **Update**, and upload the `.vsix`. (Not **New extension**: it exists. Never **Visual Studio**, which is the IDE and rejects a VS Code `.vsix` with "Value cannot be null. Parameter name: v1".)

   Publishing the packaged file (rather than `vsce publish` with no file) ships exactly what you tried in step 3. The Marketplace takes a few minutes to show the new version. For editors that use Open VSX (VSCodium, Cursor), the same file goes up with `npx ovsx publish clarusjs-vscode-X.Y.Z.vsix -p <token>`.
