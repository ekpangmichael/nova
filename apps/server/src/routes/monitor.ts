import type { FastifyPluginAsync } from "fastify";

export const monitorRoutes: FastifyPluginAsync = async (app) => {
  app.get("/monitor/summary", async () => app.services.nova.getMonitorSummary());
  app.get("/monitor/active-runs", async () =>
    app.services.nova.getMonitorActiveRuns()
  );
  app.get("/monitor/recent-failures", async () =>
    app.services.nova.getMonitorRecentFailures()
  );
};
