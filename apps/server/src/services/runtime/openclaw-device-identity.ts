import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from "node:crypto";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export type OpenClawDeviceIdentity = {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
};

type StoredOpenClawDeviceIdentity = OpenClawDeviceIdentity & {
  version: 1;
  createdAtMs: number;
};

const base64UrlEncode = (buffer: Buffer) =>
  buffer
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");

const derivePublicKeyRaw = (publicKeyPem: string) => {
  const spki = createPublicKey(publicKeyPem).export({
    type: "spki",
    format: "der",
  });

  if (
    spki.length === ED25519_SPKI_PREFIX.length + 32 &&
    spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }

  return spki;
};

const deriveDeviceId = (publicKeyPem: string) =>
  createHash("sha256").update(derivePublicKeyRaw(publicKeyPem)).digest("hex");

const normalizeStoredIdentity = (
  value: unknown
): OpenClawDeviceIdentity | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<StoredOpenClawDeviceIdentity>;

  if (
    candidate.version !== 1 ||
    typeof candidate.deviceId !== "string" ||
    typeof candidate.publicKeyPem !== "string" ||
    typeof candidate.privateKeyPem !== "string"
  ) {
    return null;
  }

  const derivedId = deriveDeviceId(candidate.publicKeyPem);

  return {
    deviceId: derivedId,
    publicKeyPem: candidate.publicKeyPem,
    privateKeyPem: candidate.privateKeyPem,
  };
};

const createIdentity = (): OpenClawDeviceIdentity => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey
    .export({
      type: "spki",
      format: "pem",
    })
    .toString();
  const privateKeyPem = privateKey
    .export({
      type: "pkcs8",
      format: "pem",
    })
    .toString();

  return {
    deviceId: deriveDeviceId(publicKeyPem),
    publicKeyPem,
    privateKeyPem,
  };
};

export const loadOrCreateOpenClawDeviceIdentity = async (appDataDir: string) => {
  const identityPath = resolve(appDataDir, "runtime", "openclaw", "device.json");

  try {
    const raw = await readFile(identityPath, "utf8");
    const parsed = normalizeStoredIdentity(JSON.parse(raw));

    if (parsed) {
      return parsed;
    }
  } catch {
    // Fall through and create a fresh device identity.
  }

  const identity = createIdentity();
  const payload: StoredOpenClawDeviceIdentity = {
    version: 1,
    createdAtMs: Date.now(),
    ...identity,
  };

  await mkdir(dirname(identityPath), { recursive: true });
  await writeFile(identityPath, `${JSON.stringify(payload, null, 2)}\n`, {
    mode: 0o600,
  });

  return identity;
};

export const buildOpenClawDeviceAuthPayloadV3 = (params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
  platform?: string | null;
  deviceFamily?: string | null;
}) =>
  [
    "v3",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(","),
    String(params.signedAtMs),
    params.token ?? "",
    params.nonce,
    params.platform?.trim() ?? "",
    params.deviceFamily?.trim() ?? "",
  ].join("|");

export const signOpenClawDevicePayload = (
  privateKeyPem: string,
  payload: string
) =>
  base64UrlEncode(
    sign(null, Buffer.from(payload, "utf8"), createPrivateKey(privateKeyPem))
  );

export const openClawPublicKeyRawBase64UrlFromPem = (publicKeyPem: string) =>
  base64UrlEncode(derivePublicKeyRaw(publicKeyPem));
