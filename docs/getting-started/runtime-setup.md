# Runtime Setup

Nova can boot without external runtimes, but real agent execution depends on local runtime tooling being installed and authenticated on the same machine.

This page documents the current supported runtimes, how Nova detects them, what authentication they need, and the model choices Nova exposes in the UI.

## Runtime support at a glance

| Runtime | Status | Auth source | Configure in Nova |
| --- | --- | --- | --- |
| OpenClaw | Supported | Your local OpenClaw profile and provider setup | `/runtimes` |
| Codex | Supported | Your local Codex CLI login | `/runtimes` |
| Claude Code | Supported | Your local Claude Code CLI login | `/runtimes` |

Nova does not ask you for provider API keys directly for Codex or Claude Code. Instead, it reuses the authenticated local CLI environment already present on your machine.

## OpenClaw

### What Nova expects

- `openclaw` is installed and available on `PATH`, or the binary path is set explicitly
- your local OpenClaw state directory exists, usually `~/.openclaw`
- your local OpenClaw config exists, usually `~/.openclaw/openclaw.json`
- the OpenClaw gateway is available through your configured profile

### How Nova authenticates

Nova does not authenticate separately to OpenClaw. It reuses your local OpenClaw profile, provider setup, gateway config, and state directory. By default Nova uses the `apm` profile.

### Models

Nova does not ship a hardcoded OpenClaw model list. It reads the model catalog from your local OpenClaw installation, so the models you see depend on your provider configuration and what `openclaw models list --json` returns on your machine.

### Known caveats

- Health checks depend on OpenClaw CLI and gateway commands, so the first status load can take a few seconds.
- If the local gateway is down or misconfigured, Nova can detect the runtime but still report it as degraded.
- OpenClaw is the runtime where Nova’s workspace-file model maps most naturally to the underlying runtime.

## Codex

### What Nova expects

- `codex` is installed and available on `PATH`, or the binary path is set explicitly
- the local Codex state directory exists, usually `~/.codex`
- the local config file exists at `~/.codex/config.toml` if you want Nova to preload a default model
- you are already signed in through the Codex CLI environment

### How Nova authenticates

Nova reuses the local authenticated Codex CLI environment. It does not prompt for an OpenAI API key in the normal Codex runtime flow.

Nova detects Codex login state from the local Codex state directory and CLI status, then lets you configure the runtime from `/runtimes`.

### Supported models

Nova currently exposes this confirmed Codex model list:

- `gpt-5.4`
- `gpt-5.4-mini`
- `gpt-5.3-codex`
- `gpt-5.2-codex`
- `gpt-5.2`
- `gpt-5.1-codex`
- `gpt-5.1-codex-max`
- `gpt-5.1-codex-mini`

### Known caveats

- Codex does not have a native runtime agent registry. Nova manages agent workspaces itself and runs Codex in the relevant execution directory.
- Nova exposes a curated confirmed model list rather than every possible experimental or undocumented Codex variant.
- Codex setup is strongest on the same machine where the Codex CLI is already installed and logged in.

## Claude Code

### What Nova expects

- `claude` is installed and available on `PATH`, or the binary path is set explicitly
- the local Claude state directory exists, usually `~/.claude`
- the local config file exists at `~/.claude/settings.json` if you want Nova to preload a default model
- you are already signed in through Claude Code

### How Nova authenticates

Nova reuses the local Claude Code CLI session. It checks `claude auth status` and reads the local state/config location. Nova does not ask you for a Claude API key for the normal Claude Code runtime path.

### Supported models

Nova currently exposes this confirmed Claude model list:

- `claude-sonnet-4-6`
- `claude-opus-4-6`
- `claude-haiku-4-5-20251001`

### Known caveats

- Claude Code also does not have a native runtime agent registry, so Nova manages agent workspaces and launches Claude against them.
- Nova uses the local Claude Code CLI model set it knows how to validate. It does not attempt to expose every plan-specific or undocumented variant.
- Some long Claude runs may still be more turn-hungry than OpenClaw or Codex, so Nova’s retry behavior is still evolving.

## Runtime configuration in the Nova UI

After Nova is running, open `/runtimes`.

For each supported runtime, Nova can:

- detect the local binary path
- detect the state and config directory
- show whether the runtime looks authenticated
- preload the default model where that makes sense
- let you enable, disable, and reconfigure the runtime

Runtime disable is real. If you disable a runtime in `/runtimes`, Nova will also block agent creation and task execution for that runtime until you enable it again.

## Agent model selection

When you create or edit an agent, Nova only lets you pick model IDs that match the selected runtime:

- OpenClaw agents use the current OpenClaw model catalog from your machine
- Codex agents use the confirmed Codex model list above
- Claude Code agents use the confirmed Claude model list above

This is intentional. Nova should not let you configure a model name it cannot actually pass to the runtime.

## Troubleshooting

### Nova says a runtime is missing

That usually means the binary is not on `PATH` and Nova could not resolve it from the expected local install path. Install the CLI first or configure the binary path explicitly in `/runtimes`.

### The runtime is detected but shown as degraded

That usually means the CLI exists but the local runtime is not logged in, or in OpenClaw’s case the gateway is unavailable.

### I only want to use one runtime

That is fine. You can leave the other runtimes unconfigured or disable them in `/runtimes`.
