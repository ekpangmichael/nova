import { constants } from "node:fs";
import { access, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const repoRoot = resolve(__dirname, "../..");
export const packagesDir = resolve(repoRoot, "packages");

export const parseDotEnv = (content) => {
  const result = {};

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
};

export const pathExists = async (path) => {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

export const loadDotEnvFiles = async () => {
  const env = {};
  const candidates = [
    resolve(repoRoot, ".env"),
    resolve(repoRoot, ".env.local"),
    resolve(packagesDir, ".env"),
    resolve(packagesDir, ".env.local"),
  ];

  for (const candidatePath of candidates) {
    try {
      const fileContent = await readFile(candidatePath, "utf8");
      Object.assign(env, parseDotEnv(fileContent));
    } catch {
      // Ignore missing env files.
    }
  }

  return env;
};

export const applyLoadedEnv = async () => {
  const loadedEnv = await loadDotEnvFiles();
  const inheritedEnv = { ...process.env };
  Object.assign(process.env, loadedEnv, inheritedEnv);
  return loadedEnv;
};

export const resolveAppDataDir = (env = process.env) => {
  const configured = env.NOVA_APP_DATA_DIR?.trim();
  return configured ? resolve(repoRoot, configured) : resolve(repoRoot, ".nova-data");
};

export const ensureAppDataDir = async (env = process.env) => {
  const appDataDir = resolveAppDataDir(env);
  await mkdir(appDataDir, { recursive: true });
  return appDataDir;
};
