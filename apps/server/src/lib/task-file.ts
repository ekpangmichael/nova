type TaskFileInput = {
  taskId: string;
  runId: string;
  projectName: string;
  agentName: string;
  title: string;
  description: string;
  resolvedExecutionTarget: string;
  attachments: string[];
  extraInstructions: string | null;
  gitBranchName?: string | null;
  gitBranchUrl?: string | null;
  gitRepoRoot?: string | null;
};

type AgentContextFileInput = {
  agentName: string;
  directiveText?: string | null;
  personaText?: string | null;
  identityText?: string | null;
  userContextText?: string | null;
  toolsText?: string | null;
  heartbeatText?: string | null;
  memoryText?: string | null;
};

export const buildTaskFile = ({
  taskId,
  runId,
  projectName,
  agentName,
  title,
  description,
  resolvedExecutionTarget,
  attachments,
  extraInstructions,
  gitBranchName,
  gitBranchUrl,
  gitRepoRoot,
}: TaskFileInput) => {
  const attachmentLines =
    attachments.length > 0
      ? attachments.map((attachment) => `- ${attachment}`).join("\n")
      : "- None";

  return `# Task
Task ID: ${taskId}
Run ID: ${runId}
Project: ${projectName}
Agent: ${agentName}

## Goal
${title}

## Description
${description || "No additional description provided."}

## Execution Target
${resolvedExecutionTarget}

## Git Workflow
Branch: ${gitBranchName?.trim() || "None"}
Branch Link: ${gitBranchUrl?.trim() || "None"}
Repository Root: ${gitRepoRoot?.trim() || "None"}

- If a branch is provided, it is already assigned to this task. Stay on that branch for this task and all follow-up runs.
- Do not create a new branch unless the operator explicitly asks for a different branch.
- If there is no branch, continue working normally and do not invent a branch link.

## Acceptance Criteria
- Complete the requested work inside the execution target
- Summarize files changed
- Report blockers clearly
- Do not touch files outside the execution target unless explicitly required

## Attachments
${attachmentLines}

## Extra Instructions
${extraInstructions?.trim() || "None"}

## Required Final Output
Only when the requested work is actually complete in this run, return:
1. a concise summary
2. changed files list
3. blockers or follow-up notes
4. the task branch name and branch link if available
5. a short question asking whether the operator wants you to open a pull request from that branch

If you are blocked on operator input or approval:
- do not post a completion summary in chat
- use the \`needs_input\` checkpoint only for state tracking
- ask the operator the exact clarification question in plain language
- never mention internal workflow terms like \`needs_input\`, checkpoint, Nova comments, runs, sessions, or pausing in operator-facing text
- then wait for the operator response
`;
};

export const buildAgentContextFile = ({
  agentName,
  directiveText,
  personaText,
  identityText,
  userContextText,
  toolsText,
  heartbeatText,
  memoryText,
}: AgentContextFileInput) => {
  const sections = [
    {
      title: "Directive / AGENTS.md",
      content: directiveText?.trim() || "Not configured.",
    },
    {
      title: "Persona / SOUL.md",
      content: personaText?.trim() || "Not configured.",
    },
    {
      title: "Identity / IDENTITY.md",
      content: identityText?.trim() || "Not configured.",
    },
    {
      title: "User Context / USER.md",
      content: userContextText?.trim() || "Not configured.",
    },
    {
      title: "Tools / TOOLS.md",
      content: toolsText?.trim() || "Not configured.",
    },
    {
      title: "Heartbeat / HEARTBEAT.md",
      content: heartbeatText?.trim() || "Not configured.",
    },
    {
      title: "Memory / MEMORY.md",
      content: memoryText?.trim() || "Not configured.",
    },
  ];

  return [
    "# Agent Context",
    "",
    `Agent: ${agentName}`,
    "",
    "Read this file before starting the task. It contains the current workspace-backed agent directive, persona, tool profile, identity, user context, and persistent notes for this run.",
    "If this file conflicts with TASK.md or the newest operator follow-up, follow TASK.md and the newest operator instruction.",
    "",
    ...sections.flatMap((section) => [
      `## ${section.title}`,
      "",
      section.content,
      "",
    ]),
  ].join("\n");
};

export const buildRuntimePrompt = (
  runId: string,
  options?: {
    followUpInstructions?: string | null;
    taskFilePath?: string | null;
    bridgeFilePath?: string | null;
    skillFilePath?: string | null;
    agentContextFilePath?: string | null;
    gitBranchName?: string | null;
    gitBranchUrl?: string | null;
  }
) => {
  const taskFilePath =
    options?.taskFilePath?.trim() || `.apm/runs/${runId}/TASK.md`;
  const bridgeFilePath =
    options?.bridgeFilePath?.trim() || `.apm/runs/${runId}/NOVA_RUNTIME.json`;
  const skillFilePath =
    options?.skillFilePath?.trim() || "skills/nova-ticket-bridge/SKILL.md";
  const agentContextFilePath =
    options?.agentContextFilePath?.trim() || `.apm/runs/${runId}/AGENT_CONTEXT.md`;
  const sections = [
    `Read ${agentContextFilePath} before you begin. It contains the agent directive, persona, tools, identity, user context, and persistent notes for this run.`,
    `Execute the task described in ${taskFilePath}.`,
    `Read ${skillFilePath} before you begin.`,
    `Use ${bridgeFilePath} if you need to post comments, checkpoints, or artifacts back to Nova.`,
    `Re-open ${taskFilePath} for this run and do not assume the previous run's goal is unchanged.`,
    "First inspect the execution target and listed inputs.",
    "Keep all work inside the execution target unless the task explicitly requires otherwise.",
    "Treat the agent context file as active guidance for this run, but if it conflicts with TASK.md or the newest operator instruction, TASK.md and the operator instruction win.",
  ];

  const followUpInstructions = options?.followUpInstructions?.trim();

  if (followUpInstructions) {
    sections.push(
      "This attempt includes a follow-up revision from the operator.",
      "Do not just restate the previous completion. Treat the newest operator follow-up as the active request for this run.",
      "If the follow-up asks for confirmation before making a change, ask the operator the exact question directly in plain language and wait instead of making an unapproved change.",
      "Never mention internal workflow terms like \\`needs_input\\`, checkpoint, Nova comments, runs, sessions, bridge calls, or pausing in operator-facing text.",
      `Follow-up instructions:\n${followUpInstructions}`
    );
  }

  sections.push(
    options?.gitBranchName?.trim()
      ? `Use the existing task branch ${options.gitBranchName.trim()} for this run. Do not create a new branch unless the operator explicitly asks.`
      : "If the task file does not provide a task branch, do not invent one.",
    options?.gitBranchUrl?.trim()
      ? `If you reference the task branch in your final handoff, use this link when helpful: ${options.gitBranchUrl.trim()}`
      : "If no branch link is provided, share the branch name only when a task branch exists.",
    "Only end with the required final output format when the requested work is fully complete in this run.",
    "If you are waiting on operator input or approval, do not emit a completion summary in chat.",
    "Keep internal progress updates and step-by-step narration in the runtime stream. Only use operator-facing comments for questions, blockers, approval requests, or the final completed handoff.",
    "When the work is complete, include the task branch in the final handoff and ask whether the operator wants you to create a pull request."
  );

  return sections.join("\n");
};
