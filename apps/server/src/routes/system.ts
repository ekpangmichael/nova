import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import { pickDirectory } from "../lib/directory-picker.js";
import { parseOrThrow } from "../lib/http.js";
import { openLocalPath } from "../lib/open-path.js";

export const systemRoutes: FastifyPluginAsync = async (app) => {
  app.post("/system/select-directory", async () => pickDirectory());
  app.post("/system/open-path", async (request) => {
    const body = parseOrThrow(
      z.object({
        path: z.string().min(1),
      }),
      request.body
    );

    return openLocalPath(body.path);
  });
};
