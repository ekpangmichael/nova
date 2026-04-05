import { describe, expect, it } from "vitest";
import { buildAgentContextFile, buildRuntimePrompt, buildTaskFile } from "./task-file.js";

describe("task-file", () => {
  it("builds a deterministic task file", () => {
    const taskFile = buildTaskFile({
      taskId: "task-123",
      runId: "run-456",
      projectName: "Nova",
      agentName: "Planner",
      title: "Implement backend slice",
      description: "Create the first Fastify vertical slice.",
      resolvedExecutionTarget: "projects/nova/server",
      attachments: ["brief.txt", "rfc.md"],
      extraInstructions: "Stay within the execution target.",
      gitBranchName: "nova/task-001-implement-backend-slice-task1234",
      gitBranchUrl:
        "https://github.com/openai/nova/tree/nova/task-001-implement-backend-slice-task1234",
      gitRepoRoot: "/workspace/projects/nova",
    });

    expect(taskFile).toContain("Task ID: task-123");
    expect(taskFile).toContain("Run ID: run-456");
    expect(taskFile).toContain("Project: Nova");
    expect(taskFile).toContain("Agent: Planner");
    expect(taskFile).toContain("projects/nova/server");
    expect(taskFile).toContain("- brief.txt");
    expect(taskFile).toContain("- rfc.md");
    expect(taskFile).toContain("Stay within the execution target.");
    expect(taskFile).toContain("nova/task-001-implement-backend-slice-task1234");
    expect(taskFile).toContain("https://github.com/openai/nova/tree/");
  });

  it("builds the runtime prompt from the run id", () => {
    expect(buildRuntimePrompt("run-456")).toContain(
      ".apm/runs/run-456/TASK.md"
    );
    expect(buildRuntimePrompt("run-456")).toContain(
      ".apm/runs/run-456/AGENT_CONTEXT.md"
    );
    expect(
      buildRuntimePrompt("run-456", {
        followUpInstructions: "Recent operator follow-up comments:\n1. Confirm the color before changing it.",
        gitBranchName: "nova/task-001-implement-backend-slice-task1234",
        gitBranchUrl:
          "https://github.com/openai/nova/tree/nova/task-001-implement-backend-slice-task1234",
      })
    ).toContain(
      "Do not just restate the previous completion"
    );
    expect(
      buildRuntimePrompt("run-456", {
        gitBranchName: "nova/task-001-implement-backend-slice-task1234",
      })
    ).toContain("Use the existing task branch");
    expect(buildRuntimePrompt("run-456")).toContain(
      "Only end with the required final output format when the requested work is fully complete in this run."
    );
  });

  it("builds an agent context file from workspace-backed text fields", () => {
    const context = buildAgentContextFile({
      agentName: "Design Lead",
      directiveText: "# Design Lead\n\nFollow the directive.",
      personaText: "## Persona\n\nBe crisp.",
      identityText: "- Name: Design Lead",
      userContextText: "User prefers minimal UI.",
      toolsText: "Use conservative defaults.",
      heartbeatText: "Check in every 30 minutes.",
      memoryText: "Project prefers soft blue accents.",
    });

    expect(context).toContain("# Agent Context");
    expect(context).toContain("## Directive / AGENTS.md");
    expect(context).toContain("## Persona / SOUL.md");
    expect(context).toContain("## Tools / TOOLS.md");
    expect(context).toContain("Follow the directive.");
    expect(context).toContain("Project prefers soft blue accents.");
  });
});
