import { slugify } from "./utils.js";

const BRANCH_SLUG_MAX_LENGTH = 40;

export const buildTaskBranchName = (
  taskNumber: number,
  title: string,
  taskId: string
) => {
  const titleSlug = slugify(title).slice(0, BRANCH_SLUG_MAX_LENGTH) || "task";
  const taskIdPrefix = taskId.slice(0, 8).toLowerCase();

  return `nova/task-${String(taskNumber).padStart(3, "0")}-${titleSlug}-${taskIdPrefix}`;
};

const normalizeGithubRemote = (remoteUrl: string) => {
  const trimmed = remoteUrl.trim();

  if (!trimmed) {
    return null;
  }

  const sshMatch = trimmed.match(/^git@github\.com:(.+?)(?:\.git)?$/i);

  if (sshMatch?.[1]) {
    return `https://github.com/${sshMatch[1]}`;
  }

  const sshProtocolMatch = trimmed.match(/^ssh:\/\/git@github\.com\/(.+?)(?:\.git)?$/i);

  if (sshProtocolMatch?.[1]) {
    return `https://github.com/${sshProtocolMatch[1]}`;
  }

  const httpsMatch = trimmed.match(/^https:\/\/github\.com\/(.+?)(?:\.git)?$/i);

  if (httpsMatch?.[1]) {
    return `https://github.com/${httpsMatch[1]}`;
  }

  return null;
};

export const buildBranchUrl = (remoteUrl: string | null, branchName: string) => {
  if (!remoteUrl) {
    return null;
  }

  const githubBaseUrl = normalizeGithubRemote(remoteUrl);

  if (!githubBaseUrl) {
    return null;
  }

  const encodedBranchPath = branchName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${githubBaseUrl}/tree/${encodedBranchPath}`;
};
