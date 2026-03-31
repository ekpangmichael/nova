export type OpenClawIdentityPatch = {
  name?: string;
  theme?: string;
  emoji?: string;
  avatar?: string;
};

const identityFieldPattern =
  /^\s*(?:[-*+]\s*)?(?:\*\*|__)?(name|theme|vibe|emoji|avatar)(?:\*\*|__)?\s*:\s*(.+?)\s*$/i;

const normalizeIdentityValue = (value: string) =>
  value
    .trim()
    .replace(/^(?:\*\*|__)\s*/u, "")
    .replace(/\s*(?:\*\*|__)$/u, "")
    .replace(/^["'`](.+)["'`]$/u, "$1")
    .trim();

export const extractOpenClawIdentityPatch = (
  content: string
): OpenClawIdentityPatch | null => {
  const patch: OpenClawIdentityPatch = {};

  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(identityFieldPattern);

    if (!match) {
      continue;
    }

    const rawKey = match[1].toLowerCase();
    const value = normalizeIdentityValue(match[2]);

    if (!value) {
      continue;
    }

    if (rawKey === "vibe") {
      patch.theme ??= value;
      continue;
    }

    patch[rawKey as keyof OpenClawIdentityPatch] ??= value;
  }

  return Object.keys(patch).length > 0 ? patch : null;
};
