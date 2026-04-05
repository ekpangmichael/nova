export const MAX_TASK_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export const TASK_ATTACHMENT_ALLOWED_EXTENSIONS = [
  "pdf",
  "json",
  "jsonc",
  "md",
  "markdown",
  "txt",
  "text",
  "html",
  "htm",
  "css",
  "scss",
  "less",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "py",
  "rb",
  "php",
  "java",
  "c",
  "cc",
  "cpp",
  "cxx",
  "h",
  "hpp",
  "go",
  "rs",
  "swift",
  "kt",
  "kts",
  "sh",
  "bash",
  "zsh",
  "yaml",
  "yml",
  "xml",
  "csv",
  "sql",
  "toml",
  "ini",
  "cfg",
  "conf",
  "log",
  "doc",
  "docx",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
] as const;

export const TASK_ATTACHMENT_ACCEPT_ATTR = TASK_ATTACHMENT_ALLOWED_EXTENSIONS.map(
  (extension) => `.${extension}`
).join(",");

const TASK_ATTACHMENT_EXTENSION_SET = new Set<string>(
  TASK_ATTACHMENT_ALLOWED_EXTENSIONS
);

export function isAllowedTaskAttachment(input: {
  fileName: string;
  mimeType?: string | null;
}) {
  const normalized = input.fileName.trim().toLowerCase();
  const lastDot = normalized.lastIndexOf(".");
  const extension =
    lastDot > 0 && lastDot < normalized.length - 1
      ? normalized.slice(lastDot + 1)
      : "";

  if (extension && TASK_ATTACHMENT_EXTENSION_SET.has(extension)) {
    return true;
  }

  const normalizedMime = (input.mimeType ?? "").trim().toLowerCase();
  return normalizedMime.startsWith("text/")
    ? true
    : [
        "application/pdf",
        "application/json",
        "application/xml",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ].includes(normalizedMime);
}
