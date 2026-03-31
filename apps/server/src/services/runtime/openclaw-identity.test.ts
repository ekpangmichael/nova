import { describe, expect, it } from "vitest";
import { extractOpenClawIdentityPatch } from "./openclaw-identity.js";

describe("extractOpenClawIdentityPatch", () => {
  it("extracts supported identity fields from markdown bullets", () => {
    expect(
      extractOpenClawIdentityPatch(
        [
          "# IDENTITY.md - Who Am I?",
          "",
          "- Name: Research Lead",
          "- Vibe: calm, rigorous, precise",
          "- Emoji: 🔬",
          "- Avatar: avatars/research-lead.png",
        ].join("\n")
      )
    ).toEqual({
      name: "Research Lead",
      theme: "calm, rigorous, precise",
      emoji: "🔬",
      avatar: "avatars/research-lead.png",
    });
  });

  it("supports bold markdown labels and explicit theme", () => {
    expect(
      extractOpenClawIdentityPatch(
        [
          "**Name:** Ted",
          "**Theme:** Nova",
          "**Emoji:** 🦞",
        ].join("\n")
      )
    ).toEqual({
      name: "Ted",
      theme: "Nova",
      emoji: "🦞",
    });
  });

  it("returns null for free-form prose without supported fields", () => {
    expect(
      extractOpenClawIdentityPatch(
        "I am a careful research partner who prefers concise, sourced answers."
      )
    ).toBeNull();
  });
});
