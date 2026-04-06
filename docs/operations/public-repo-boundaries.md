# Public Repo Boundaries

This document defines what belongs in the public Nova repository and what must
remain local to a machine or deployment.

## Public

- source code
- docs
- migrations
- reproducible fixtures and tests
- example configuration without secrets

## Must stay local

- `.nova-data/`
- runtime session state
- attachments uploaded by users
- generated logs containing local paths or secrets
- OAuth client secrets and local runtime credentials
- machine-specific editor or launcher config

## Runtime credentials

Nova integrates with local runtimes such as OpenClaw, Codex, and Claude Code.
Those credentials and authenticated local session files should never be committed
to the repository.

## Machine-specific files

Examples of files that should not be committed:

- `.env`
- `.env.local`
- `.claude/`
- `.tmp/`
- local screenshots
- local sqlite databases

## Review rule

Before pushing to the public repository:

1. inspect `git status`
2. confirm no secrets or local state are staged
3. confirm new files are source, docs, tests, or templates only

For user-facing storage, data-flow, and deployment boundaries, see
[Support Boundaries](./support-boundaries.md).
