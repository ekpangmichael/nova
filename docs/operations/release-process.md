# Release Process

Nova uses semantic-release for versioning, changelog generation, GitHub releases, and package version synchronization.

## Versioning model

Nova follows semantic versioning through conventional commits:

- `fix:` produces a patch release
- `feat:` produces a minor release
- `!` or `BREAKING CHANGE:` produces a major release

Commits that do not describe a releasable change, such as most `docs:` or `chore:` commits, do not produce a release by default.

Release tags use this format:

- `v1.2.3`

## Source of truth

The release workflow treats Git history on `main` as the source of truth.

semantic-release:

- analyzes commits since the last release tag
- decides the next version
- updates `CHANGELOG.md`
- updates version fields in:
  - root `package.json`
  - `packages/cli/package.json`
- creates a GitHub release and tag

## Changelog flow

`CHANGELOG.md` is generated and maintained automatically. Do not hand-edit it during normal development.

If you want to preview the next release locally:

```bash
pnpm release:dry-run
```

## CI expectations

Before a change reaches `main`, Nova expects the same verification used in CI:

```bash
pnpm ci:verify
```

That currently runs:

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm docs:build`

The GitHub Actions CI workflow runs the same verification on pull requests and on pushes to `main`.

## Release workflow

On every push to `main`, the release workflow:

1. checks out the full git history
2. installs dependencies
3. runs `pnpm ci:verify`
4. runs `pnpm release`

If there are releasable commits since the last tag, semantic-release creates the next release automatically.

## Repository settings for public launch

For a clean public launch, configure GitHub with at least:

- default branch: `main`
- branch protection on `main`
- required status checks:
  - `CI / verify`
- require pull request before merging
- disallow force-pushes to `main`
- require branches to be up to date before merge

Recommended:

- squash merge enabled
- merge commits disabled
- rebase merge optional, based on team preference
- auto-delete head branches after merge

## Secrets and permissions

The GitHub release workflow uses the built-in `GITHUB_TOKEN` with:

- `contents: write`
- `issues: write`
- `pull-requests: write`

No npm token is required in the current scaffolding because the repo is only preparing package versions, not publishing to npm yet.

If you later want semantic-release to publish `nova-cli` to npm, add either:

- trusted publishing for npm
- or `NPM_TOKEN` as a repository secret

and then extend the release config to enable actual npm publication.

## Commit discipline

semantic-release only works well when commit messages are intentional. For public-release branches and PRs, prefer conventional commits such as:

- `feat: add runtime setup guide`
- `fix: handle missing codex auth state`
- `docs: clarify lan install caveats`

This keeps release notes and version bumps predictable.
