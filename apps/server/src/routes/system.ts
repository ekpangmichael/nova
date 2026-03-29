import type { FastifyPluginAsync } from "fastify";
import { pickDirectory } from "../lib/directory-picker.js";

export const systemRoutes: FastifyPluginAsync = async (app) => {
  app.post("/system/select-directory", async () => pickDirectory());
};
