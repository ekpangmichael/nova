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

If you are blocked on operator input or approval:
- do not post a completion summary in chat
- use the \`needs_input\` checkpoint only for state tracking
- ask the operator the exact clarification question in plain language
- never mention internal workflow terms like \`needs_input\`, checkpoint, Nova comments, runs, sessions, or pausing in operator-facing text
- then wait for the operator response
`;
};

export const buildRuntimePrompt = (
  runId: string,
  options?: {
    followUpInstructions?: string | null;
  }
) => {
  const sections = [
    `Execute the task described in .apm/runs/${runId}/TASK.md.`,
    "Read skills/nova-ticket-bridge/SKILL.md before you begin.",
    `Use .apm/runs/${runId}/NOVA_RUNTIME.json if you need to post comments, checkpoints, or artifacts back to Nova.`,
    "Re-open TASK.md for this run and do not assume the previous run's goal is unchanged.",
    "First inspect the execution target and listed inputs.",
    "Keep all work inside the execution target unless the task explicitly requires otherwise.",
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
    "Only end with the required final output format when the requested work is fully complete in this run.",
    "If you are waiting on operator input or approval, do not emit a completion summary in chat."
  );

  return sections.join("\n");
};
