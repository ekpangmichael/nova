import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => app.services.nova.getAppHealth());
  app.get("/runtime/health", async () => app.services.nova.getRuntimeHealth());
  app.post("/runtime/setup", async () => app.services.nova.setupRuntime());
  app.post("/runtime/restart", async () => app.services.nova.restartRuntime());
};
