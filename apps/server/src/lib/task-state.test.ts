import { describe, expect, it } from "vitest";
import { canManuallyTransitionTask } from "./task-state.js";

describe("canManuallyTransitionTask", () => {
  it("allows the primary kanban workflow transitions", () => {
    expect(canManuallyTransitionTask("backlog", "todo")).toBe(true);
    expect(canManuallyTransitionTask("todo", "in_progress")).toBe(true);
    expect(canManuallyTransitionTask("in_progress", "in_review")).toBe(true);
    expect(canManuallyTransitionTask("in_review", "done")).toBe(true);
  });

  it("allows operators to pause and unblock active work", () => {
    expect(canManuallyTransitionTask("todo", "paused")).toBe(true);
    expect(canManuallyTransitionTask("in_progress", "blocked")).toBe(true);
    expect(canManuallyTransitionTask("blocked", "in_progress")).toBe(true);
    expect(canManuallyTransitionTask("paused", "todo")).toBe(true);
  });

  it("still rejects unsupported jumps", () => {
    expect(canManuallyTransitionTask("backlog", "done")).toBe(false);
    expect(canManuallyTransitionTask("done", "todo")).toBe(false);
    expect(canManuallyTransitionTask("canceled", "todo")).toBe(false);
  });
});
