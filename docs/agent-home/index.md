# Agent Home

An **Agent Home** is the on-disk directory structure that defines an agent's identity, capabilities, and local state. Each agent registered in Nova has an Agent Home path (`agentHomePath`) that points to its root directory.

> **Canonical term**: Use "Agent Home" instead of "workspace" when referring to an agent's root directory. See the [Code Conventions](../contributing/code-conventions.md) for the full list of canonical terms.

## Directory Structure

A typical Agent Home follows this layout:

```
<agent-home>/
  IDENTITY.md         Agent identity and persona definition
  SOUL.md             Core directive and behavioral guidelines
  TOOLS.md            Available tools and their configurations
  .apm/               Agent Package Manager state directory
    config.json       Local agent configuration
    state/            Runtime state files
  projects/           Project-specific context and files
    <project-slug>/   Per-project working directory
  skills/             Skill definitions and configurations
    <skill-name>/
      SKILL.md        Skill manifest and instructions
```

## Key Files

### IDENTITY.md

Defines the agent's persona, role, and contextual information. This is loaded as the `identityText` field on the `AgentRecord` and injected into the agent's system prompt.

### SOUL.md

Contains the agent's core directive and behavioral boundaries. Mapped to the `personaText` field. This document shapes how the agent approaches problems, communicates, and makes decisions.

### TOOLS.md

Describes the tools available to the agent and any constraints on their usage. Mapped to the `toolsText` field. Runtimes that support tool configuration will parse this to set up the agent's tool environment.

### .apm/ Directory

The Agent Package Manager directory stores local configuration and runtime state:

- `config.json` -- Agent-specific settings that override global defaults.
- `state/` -- Mutable runtime state (session history, memory snapshots, etc.).

### projects/

Contains project-specific context. When an agent is assigned to a project, a subdirectory matching the project slug is used for project-local files and context.

### skills/

Contains skill definitions. Each skill is a subdirectory with a `SKILL.md` manifest that describes the skill's purpose, triggers, and instructions.

## Agent Record Fields

The following `AgentRecord` fields relate to Agent Home contents:

| Field | Source |
|---|---|
| `agentHomePath` | Root path of the Agent Home directory. |
| `systemInstructions` | Primary system prompt (may be authored separately or composed from Agent Home documents). |
| `personaText` | Contents of `SOUL.md`. |
| `identityText` | Contents of `IDENTITY.md`. |
| `toolsText` | Contents of `TOOLS.md`. |
| `userContextText` | User-provided context injected into the prompt. |
| `heartbeatText` | Heartbeat / keep-alive instructions. |
| `memoryText` | Persistent memory content. |

## Runtime State Path

Separate from the Agent Home, each agent also has a `runtimeStatePath` that points to the runtime-specific state directory (e.g., OpenClaw state, Codex state, or Claude state). This is where the runtime stores session data, conversation history, and execution logs.

## Storage Location

By default, Agent Home directories are stored under the application data directory at `<NOVA_APP_DATA_DIR>/agent-homes/`. This can be overridden per agent when creating or editing the agent via the UI or API.
