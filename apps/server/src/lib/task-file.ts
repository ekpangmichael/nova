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
Return:
1. a concise summary
2. changed files list
3. blockers or follow-up notes
`;
};

export const buildRuntimePrompt = (runId: string) =>
  `Execute the task described in .apm/runs/${runId}/TASK.md.\nFirst inspect the execution target and listed inputs.\nKeep all work inside the execution target unless the task explicitly requires otherwise.\nEnd with the required final output format.`;
