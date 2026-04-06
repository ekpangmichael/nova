# Support Boundaries

This document defines Nova's current support boundaries for storage, data flow, and deployment expectations.

## Local storage

By default Nova stores state under `.nova-data/` in the repository root, unless `NOVA_APP_DATA_DIR` points somewhere else.

Typical local-only contents:

- SQLite database
- task attachments
- comment attachments
- generated agent homes
- temporary run staging files
- local logs

Nova also relies on each runtime's own local state:

- OpenClaw: usually `~/.openclaw`
- Codex: usually `~/.codex`
- Claude Code: usually `~/.claude`

Those runtime directories are not Nova's data, but Nova reads them to detect auth state, config, binary setup, and runtime defaults.

## What Nova sends to external runtimes

When you start or continue a task, Nova sends task context to the selected runtime. That typically includes:

- task title and description
- technical instructions
- selected agent identity and context files
- current operator follow-up comment if the run was triggered from a comment
- task and comment attachments staged into the run input directory
- the relevant execution target path

Nova may also expose the execution target filesystem to the runtime, because that is the point of the task run.

## Runtime-specific note

What leaves your machine beyond Nova depends on the runtime you choose:

- **OpenClaw** sends task content through whatever providers and models you have configured in your local OpenClaw setup
- **Codex** sends runtime input through your local authenticated Codex environment
- **Claude Code** sends runtime input through your local authenticated Claude Code environment

Nova itself is local-first, but the actual model execution may still involve third-party providers through the selected runtime.

## What should never be committed

These are local-only and should never be pushed to the public repository:

- `.nova-data/`
- `.env`
- `.env.local`
- runtime auth/session state
- uploaded attachments
- local screenshots
- OAuth client secrets
- machine-specific editor, launcher, or CLI settings

See [Public Repo Boundaries](./public-repo-boundaries.md) for the repository hygiene side of this.

## Supported platforms and workflows

Nova currently targets trusted local development environments first.

### Supported well today

- macOS local development
- single-machine usage
- same-LAN usage through `pnpm dev:lan`
- local git-backed execution targets
- local OpenClaw, Codex, and Claude Code CLI workflows

### Supported with caveats

- Linux development if the required CLIs are installed and on `PATH`
- Google sign-in for local `localhost` workflows
- LAN access for other devices on the same Wi-Fi

### Not a primary target today

- public internet exposure
- multi-tenant hosted deployment
- untrusted shared-machine deployments
- Windows-specific setup guarantees
- remote runtimes running on a different machine from Nova

## Operational expectation

Treat Nova as an operator tool running on a trusted machine with trusted local runtime installations.

If you need a hosted, internet-facing, or multi-tenant control plane, that is outside Nova's current support boundary.
