import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";
import { badRequest, serviceUnavailable } from "./errors.js";
import { isAbsoluteHostPath, normalizeAbsolutePath } from "./paths.js";

const execFileAsync = promisify(execFile);

export async function openLocalPath(inputPath: string) {
  const candidate = inputPath.trim();

  if (!candidate) {
    throw badRequest("Path is required.");
  }

  if (!isAbsoluteHostPath(candidate)) {
    throw badRequest("Path must be absolute.");
  }

  const normalizedPath = normalizeAbsolutePath(candidate);
  const entry = await stat(normalizedPath).catch(() => null);

  if (!entry) {
    throw badRequest("Path does not exist.");
  }

  const kind = entry.isDirectory() ? "directory" : "file";

  try {
    if (process.platform === "darwin") {
      await execFileAsync("open", [normalizedPath]);
    } else if (process.platform === "win32") {
      await execFileAsync("explorer.exe", [normalizedPath]);
    } else {
      await execFileAsync("xdg-open", [normalizedPath]);
    }
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Could not open the requested path.";
    throw serviceUnavailable(message);
  }

  return {
    path: normalizedPath,
    kind,
  };
}
