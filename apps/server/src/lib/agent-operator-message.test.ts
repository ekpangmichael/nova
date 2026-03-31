import { describe, expect, it } from "vitest";
import { humanizeAgentOperatorMessage } from "./agent-operator-message.js";

describe("humanizeAgentOperatorMessage", () => {
  it("leaves normal operator-facing replies unchanged", () => {
    const body = "What color would you like me to use for the landing page?";
    expect(humanizeAgentOperatorMessage(body)).toBe(body);
  });

  it("extracts the direct question when internal workflow text leaks into a reply", () => {
    const body =
      "I’ll post a needs_input checkpoint to Nova. Which color would you like for the title? Please confirm the exact hex code.";

    expect(humanizeAgentOperatorMessage(body)).toBe(
      "Which color would you like for the title? Please confirm the exact hex code."
    );
  });

  it("rewrites internal meta commentary into a human clarification question", () => {
    const body =
      "Need operator input before implementing. I’ll post a needs_input checkpoint and ask the exact color-scheme question to Nova, then pause.";

    expect(humanizeAgentOperatorMessage(body)).toBe(
      "What color scheme would you like me to use before I continue?"
    );
  });
});
