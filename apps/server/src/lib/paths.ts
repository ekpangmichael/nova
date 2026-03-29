import { posix, relative, resolve, sep, win32 } from "node:path";
import { badRequest, conflict } from "./errors.js";

const WINDOWS_ABSOLUTE_PATH = /^[a-zA-Z]:[\\/]/;

export const isAbsoluteHostPath = (input: string) => {
  const candidate = input.trim();
  return candidate.startsWith("/") || WINDOWS_ABSOLUTE_PATH.test(candidate);
};

export const normalizeRelativePath = (input: string) => {
  const candidate = input.trim().replace(/\\/g, "/");

  if (!candidate) {
    throw badRequest("Path is required.");
  }

  if (candidate.startsWith("/") || WINDOWS_ABSOLUTE_PATH.test(candidate)) {
    throw badRequest("Path must be relative.");
  }

  const segments = candidate.split("/").filter(Boolean);

  if (segments.length === 0) {
    throw badRequest("Path must not be empty.");
  }

  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      throw badRequest("Path traversal is not allowed.");
    }
  }

  return segments.join("/");
};

export const normalizeAbsolutePath = (input: string) => {
  const candidate = input.trim();

  if (!candidate) {
    throw badRequest("Path is required.");
  }

  if (WINDOWS_ABSOLUTE_PATH.test(candidate)) {
    return win32.normalize(candidate).replace(/\\/g, "/");
  }

  if (candidate.startsWith("/")) {
    return posix.normalize(candidate);
  }

  throw badRequest("Path must be absolute.");
};

export const normalizeProjectPath = (input: string) =>
  isAbsoluteHostPath(input)
    ? normalizeAbsolutePath(input)
    : normalizeRelativePath(input);

export const resolvePathWithinBase = (basePath: string, input: string) => {
  const normalized = normalizeRelativePath(input);
  const resolved = resolve(basePath, normalized);
  const rel = relative(basePath, resolved);

  if (rel === "" || rel.startsWith(`..${sep}`) || rel === "..") {
    throw conflict("Resolved path escapes the agent home.");
  }

  return {
    relativePath: normalized,
    absolutePath: resolved,
  };
};

export const resolveProjectPath = (agentHomePath: string, input: string) => {
  const normalizedPath = normalizeProjectPath(input);

  if (isAbsoluteHostPath(normalizedPath)) {
    return {
      normalizedPath,
      absolutePath: normalizedPath,
      isAbsolute: true,
    };
  }

  const resolved = resolvePathWithinBase(agentHomePath, normalizedPath);

  return {
    normalizedPath: resolved.relativePath,
    absolutePath: resolved.absolutePath,
    isAbsolute: false,
  };
};

export const resolveExecutionTargetPath = (
  agentHomePath: string,
  projectRoot: string,
  override?: string | null
) => {
  const projectRootPath = resolveProjectPath(agentHomePath, projectRoot);

  if (!override) {
    return projectRootPath;
  }

  const normalizedOverride = normalizeProjectPath(override);

  if (isAbsoluteHostPath(normalizedOverride)) {
    return {
      normalizedPath: normalizedOverride,
      absolutePath: normalizedOverride,
      isAbsolute: true,
    };
  }

  if (projectRootPath.isAbsolute) {
    const resolved = resolvePathWithinBase(
      projectRootPath.absolutePath,
      normalizedOverride
    );

    return {
      normalizedPath: normalizeAbsolutePath(resolved.absolutePath),
      absolutePath: resolved.absolutePath,
      isAbsolute: true,
    };
  }

  const anchoredRelativePath =
    normalizedOverride === projectRootPath.normalizedPath ||
    normalizedOverride.startsWith(`${projectRootPath.normalizedPath}/`)
      ? normalizedOverride
      : `${projectRootPath.normalizedPath}/${normalizedOverride}`;
  const resolved = resolvePathWithinBase(agentHomePath, anchoredRelativePath);

  return {
    normalizedPath: anchoredRelativePath,
    absolutePath: resolved.absolutePath,
    isAbsolute: false,
  };
};

export const sanitizeFileName = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "attachment";
