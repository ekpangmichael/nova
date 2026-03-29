import { describe, expect, it } from "vitest";
import {
  normalizeAbsolutePath,
  normalizeProjectPath,
  normalizeRelativePath,
  resolveExecutionTargetPath,
  resolvePathWithinBase,
  resolveProjectPath,
  sanitizeFileName,
} from "./paths.js";

describe("paths", () => {
  it("normalizes safe relative paths", () => {
    expect(normalizeRelativePath("projects\\client-a\\src")).toBe(
      "projects/client-a/src"
    );
    expect(normalizeRelativePath("projects/client-a")).toBe("projects/client-a");
  });

  it("rejects absolute paths and traversal", () => {
    expect(() => normalizeRelativePath("/tmp/test")).toThrowError(/relative/i);
    expect(() => normalizeRelativePath("C:\\temp\\test")).toThrowError(/relative/i);
    expect(() => normalizeRelativePath("../escape")).toThrowError(/traversal/i);
    expect(() => normalizeRelativePath("./local")).toThrowError(/traversal/i);
  });

  it("resolves paths inside the provided base directory", () => {
    const result = resolvePathWithinBase("/tmp/nova-agent", "projects/client-a");

    expect(result.relativePath).toBe("projects/client-a");
    expect(result.absolutePath).toContain("/tmp/nova-agent");
    expect(result.absolutePath.endsWith("/projects/client-a")).toBe(true);
  });

  it("normalizes absolute project paths", () => {
    expect(normalizeAbsolutePath("/tmp/nova//workspace")).toBe("/tmp/nova/workspace");
    expect(normalizeProjectPath("/tmp/nova/workspace")).toBe("/tmp/nova/workspace");
    expect(normalizeProjectPath("C:\\nova\\workspace")).toBe("C:/nova/workspace");
  });

  it("resolves absolute project roots without rebasing them under the agent home", () => {
    const result = resolveProjectPath("/tmp/nova-agent", "/tmp/external-repo");

    expect(result.normalizedPath).toBe("/tmp/external-repo");
    expect(result.absolutePath).toBe("/tmp/external-repo");
    expect(result.isAbsolute).toBe(true);
  });

  it("resolves relative execution overrides inside the project root", () => {
    const result = resolveExecutionTargetPath(
      "/tmp/nova-agent",
      "projects/client-a",
      "server"
    );

    expect(result.normalizedPath).toBe("projects/client-a/server");
    expect(result.absolutePath.endsWith("/projects/client-a/server")).toBe(true);
  });

  it("resolves relative overrides against an absolute project root", () => {
    const result = resolveExecutionTargetPath(
      "/tmp/nova-agent",
      "/tmp/external-repo",
      "server"
    );

    expect(result.normalizedPath).toBe("/tmp/external-repo/server");
    expect(result.absolutePath).toBe("/tmp/external-repo/server");
  });

  it("sanitizes uploaded file names", () => {
    expect(sanitizeFileName("brief v1?.md")).toBe("brief_v1_.md");
    expect(sanitizeFileName("")).toBe("attachment");
  });
});
