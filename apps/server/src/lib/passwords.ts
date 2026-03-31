import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const PASSWORD_PREFIX = "scrypt";
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

export const hashPassword = async (password: string) => {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

  return `${PASSWORD_PREFIX}:${salt}:${derivedKey.toString("hex")}`;
};

export const verifyPassword = async (password: string, passwordHash: string) => {
  const [scheme, salt, expectedHash] = passwordHash.split(":");

  if (scheme !== PASSWORD_PREFIX || !salt || !expectedHash) {
    return false;
  }

  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (expectedBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedBuffer);
};
