import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));
const localWebOrigin = process.env.NEXT_PUBLIC_WEB_ORIGIN ?? null;

const allowedDevOrigins = (() => {
  if (!localWebOrigin) {
    return undefined;
  }

  try {
    const url = new URL(localWebOrigin);
    return [url.hostname];
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  allowedDevOrigins,
  turbopack: {
    root: workspaceRoot,
  },
};

export default nextConfig;
