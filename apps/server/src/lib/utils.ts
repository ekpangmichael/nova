import { randomUUID } from "node:crypto";

export const nowIso = () => new Date().toISOString();

export const generateId = () => randomUUID();

export const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

export const parseJsonText = <T>(
  value: string | null | undefined,
  fallback: T
): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const stringifyJson = (value: unknown) => JSON.stringify(value ?? null);
