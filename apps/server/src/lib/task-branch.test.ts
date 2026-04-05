import { describe, expect, it } from "vitest";
import { buildBranchUrl, buildTaskBranchName } from "./task-branch.js";

describe("task-branch", () => {
  it("builds a stable task branch name", () => {
    expect(
      buildTaskBranchName(
        7,
        "Design a landing page for Orbit Shop",
        "08540143-b5aa-4bdd-9983-a5f503811320"
      )
    ).toBe("nova/task-007-design-a-landing-page-for-orbit-shop-08540143");
  });

  it("builds a GitHub branch URL from ssh and https remotes", () => {
    expect(
      buildBranchUrl(
        "git@github.com:openai/nova.git",
        "nova/task-007-design-a-landing-page-08540143"
      )
    ).toBe(
      "https://github.com/openai/nova/tree/nova/task-007-design-a-landing-page-08540143"
    );

    expect(
      buildBranchUrl(
        "https://github.com/openai/nova.git",
        "nova/task-007-design-a-landing-page-08540143"
      )
    ).toBe(
      "https://github.com/openai/nova/tree/nova/task-007-design-a-landing-page-08540143"
    );
  });

  it("returns null for unsupported remotes", () => {
    expect(buildBranchUrl("https://gitlab.com/openai/nova.git", "nova/task-1")).toBe(
      null
    );
  });
});
