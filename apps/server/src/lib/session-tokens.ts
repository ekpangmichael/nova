import { createHash, randomBytes } from "node:crypto";

export const createSessionToken = () => {
  const token = randomBytes(32).toString("base64url");

  return {
    token,
    tokenHash: hashSessionToken(token),
  };
};

export const hashSessionToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
