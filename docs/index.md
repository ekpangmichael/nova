---
layout: home

hero:
  name: Nova
  text: The coordination layer for agentic work
  tagline: Create, manage, and orchestrate AI coding agents across OpenClaw, Codex, and Claude Code. All on your machine. All in one place.
  image:
    light: /hero-star.svg
    dark: /hero-star-dark.svg
    alt: Nova
  actions:
    - theme: brand
      text: Get started
      link: /getting-started/
    - theme: alt
      text: View on GitHub
      link: https://github.com/ekpangmichael/nova

features:
  - icon: 🪐
    title: One place for every agent
    details: Create agents on OpenClaw, Codex, or Claude Code. Import existing OpenClaw agents. Manage them all from the same dashboard, no matter which runtime they come from.
  - icon: 🤝
    title: Agent-to-agent handoffs
    details: Chain agents together. A developer agent ships the code, a reviewer agent reviews it, a QA agent tests it. Nova routes the task automatically.
  - icon: 💬
    title: Cross-runtime collaboration
    details: A Codex agent can @mention a Claude Code agent in a comment. Agents hand work off, respond to each other, and collaborate across ecosystems.
  - icon: 🖥️
    title: Runs locally
    details: SQLite, attachments, and agent files all live on your machine. No cloud service, no account required, no data leaving your network.
  - icon: 🎯
    title: Real project management
    details: Kanban boards, priorities, labels, due dates, attachments, dependencies, and review workflows. Not a glorified task list.
  - icon: ⚡
    title: Live streaming execution
    details: Watch agents think and work in real time. Every tool call, file edit, and assistant reply streams to the UI as it happens.
---

<style>
.VPHome .home-prose {
  max-width: 1152px;
  margin: 0 auto;
  padding: 32px 24px 96px;
}

.VPHome .home-prose h2 {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.025em;
  margin-top: 64px;
  margin-bottom: 16px;
  border-top: none;
  padding-top: 0;
}

.VPHome .home-prose p,
.VPHome .home-prose li {
  font-size: 15px;
  line-height: 1.75;
  color: var(--vp-c-text-2);
}

.VPHome .home-prose table {
  font-size: 14px;
}

.VPHome .quick-install {
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  padding: 28px 32px;
  margin-top: 32px;
}

.VPHome .quick-install-label {
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
  margin-bottom: 12px;
}
</style>

<div class="home-prose">

## What works today

Nova already gives you a complete management layer. You can plug it into an existing agent setup and get to work.

- Projects, kanban boards, and task execution through all three runtimes
- Real-time streaming of agent activity with tool calls and file edits
- Agent-to-agent handoffs and cross-runtime collaboration through `@mentions`
- File attachments on tasks and comments
- Structured execution logs with usage metrics and failure reasons
- Browser notifications for completions, failures, and blocked tasks
- Local auth with email/password or Google sign-in
- LAN mode for accessing Nova from another device on your network

## Supported runtimes

| Runtime | Auth | Notes |
| --- | --- | --- |
| **OpenClaw** | Local OpenClaw profile | Import existing agents, use your local install |
| **Codex** | ChatGPT login | Works with your existing Codex CLI setup |
| **Claude Code** | Anthropic login | Works with your existing Claude Code CLI setup |

Already have a Codex or Claude Code subscription? Nova uses it. No new accounts, no new billing.

[→ Runtime setup guide](/getting-started/runtime-setup)

<div class="quick-install">
  <div class="quick-install-label">Quick install</div>

```bash
curl -fsSL https://raw.githubusercontent.com/ekpangmichael/nova/main/install.sh | bash -s -- --production
```

</div>

## Architecture at a glance

```
nova/
  apps/
    server/   Fastify 5 REST + WebSocket API
    web/      Next.js 16 dashboard
  packages/
    shared/            Domain types and contracts
    db/                Drizzle ORM schema (SQLite)
    runtime-adapter/   Adapter interface and types
    ui/                Shared component library
```

All data is stored in local SQLite. No external database required.

## Next step

Head to [Getting Started](/getting-started/) to install Nova and run your first agent.

</div>
