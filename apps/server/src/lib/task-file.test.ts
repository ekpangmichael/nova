import { describe, expect, it } from "vitest";
import { buildRuntimePrompt, buildTaskFile } from "./task-file.js";

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
    });

    expect(taskFile).toContain("Task ID: task-123");
    expect(taskFile).toContain("Run ID: run-456");
    expect(taskFile).toContain("Project: Nova");
    expect(taskFile).toContain("Agent: Planner");
    expect(taskFile).toContain("projects/nova/server");
    expect(taskFile).toContain("- brief.txt");
    expect(taskFile).toContain("- rfc.md");
    expect(taskFile).toContain("Stay within the execution target.");
  });

  it("builds the runtime prompt from the run id", () => {
    expect(buildRuntimePrompt("run-456")).toContain(
      ".apm/runs/run-456/TASK.md"
    );
    expect(
      buildRuntimePrompt("run-456", {
        followUpInstructions: "Recent operator follow-up comments:\n1. Confirm the color before changing it.",
      })
    ).toContain(
      "Do not just restate the previous completion"
    );
    expect(buildRuntimePrompt("run-456")).toContain(
      "Only end with the required final output format when the requested work is fully complete in this run."
    );
  });
});
