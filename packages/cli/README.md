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
3. runs Nova's bootstrap step with `pnpm run setup`

For a guided production install, use:

```bash
npx nova-cli@latest setup-production
```

This flow is designed for production operators, not contributors. It:

1. clones or reuses a Nova checkout
2. asks for production-specific settings like app data path, ports, web origin, runtime mode, and optional Google auth
3. writes `.env.local`
4. runs `pnpm install` and `pnpm run setup`
5. builds Nova for production
6. on macOS, can install the LaunchAgent service automatically

## Usage

```bash
nova setup [directory] [--repo <url>] [--ref <git-ref>] [--skip-install] [--skip-bootstrap]
nova setup-production [directory] [--repo <url>] [--ref <git-ref>] [--yes] [--skip-install] [--skip-bootstrap] [--skip-build] [--skip-service-install]
```

Examples:

```bash
npx nova-cli@latest setup
npx nova-cli@latest setup my-nova
npx nova-cli@latest setup my-nova --ref main
npx nova-cli@latest setup-production
npx nova-cli@latest setup-production my-nova --yes --skip-service-install
```

## Release behavior

By default, `nova setup` tries to clone the latest tagged release.

If the repository does not have any release tags yet, it falls back to the repository's default branch.

## Repository

- Source: <https://github.com/ekpangmichael/nova>
