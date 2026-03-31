import type { FastifyPluginAsync } from "fastify";

export const runtimeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/runtimes", async () => app.services.nova.listRuntimes());

  app.get("/runtimes/openclaw/catalog", async () =>
    app.services.nova.getOpenClawCatalog()
  );
};
