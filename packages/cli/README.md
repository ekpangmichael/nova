# nova-cli

Bootstrap and manage a local Nova workspace.

## Intended install path

Once published, the primary installer flow is:

```bash
npx nova-cli@latest setup
```

This command:

1. clones the Nova repository into `./nova` by default
2. installs dependencies with `pnpm install`
3. runs Nova's bootstrap step with `pnpm setup`

## Usage

```bash
nova setup [directory] [--repo <url>] [--ref <git-ref>] [--skip-install] [--skip-bootstrap]
```

Examples:

```bash
npx nova-cli@latest setup
npx nova-cli@latest setup my-nova
npx nova-cli@latest setup my-nova --ref main
```

## Release behavior

By default, `nova setup` tries to clone the latest tagged release.

If the repository does not have any release tags yet, it falls back to the repository's default branch.

## Repository

- Source: <https://github.com/ekpangmichael/nova>
