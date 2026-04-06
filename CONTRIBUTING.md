# Contributing to Nova

Thanks for contributing to Nova.

## Before you start

- Read [README.md](README.md) and the docs in [`docs/`](docs/).
- Search existing issues and pull requests before opening a new one.
- Keep changes scoped. Nova touches multiple runtimes and the local filesystem, so broad refactors are harder to review safely.

## Development setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Start Nova:

```bash
pnpm dev
```

Useful commands:

```bash
pnpm typecheck
pnpm test
pnpm docs:dev
```

## Contribution guidelines

- Prefer focused pull requests.
- Include tests when changing runtime behavior, API contracts, or task/workflow logic.
- Update docs when behavior, install flow, or runtime support changes.
- Do not commit local state, credentials, runtime sessions, screenshots, or `.nova-data` artifacts.
- Do not commit machine-specific config or editor state.

## Branches and commits

- Branch from `main`.
- Use descriptive branch names.
- Use conventional commit messages whenever possible:
  - `feat: ...`
  - `fix: ...`
  - `docs: ...`
  - `chore: ...`
- Use `!` or `BREAKING CHANGE:` when a release should be treated as a major version bump.

## Pull requests

Each PR should include:

- what changed
- why it changed
- how it was tested
- any follow-up work or limitations

If the change affects runtimes, mention which runtimes were verified:

- OpenClaw
- Codex
- Claude Code

Before asking for review, run:

```bash
pnpm ci:verify
```

Nova's public release flow is driven by semantic-release, so commit message quality affects versioning and release notes.

## Reporting bugs

Use the bug report template and include:

- operating system
- Node and package manager versions
- runtime in use
- exact steps to reproduce
- relevant logs or screenshots

## Security

Please do not open public issues for security vulnerabilities. Follow the process in [SECURITY.md](SECURITY.md).
