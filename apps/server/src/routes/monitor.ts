import type { FastifyPluginAsync } from "fastify";

export const monitorRoutes: FastifyPluginAsync = async (app) => {
  app.get("/dashboard/stats", async () => app.services.nova.getDashboardStats());
  app.get("/dashboard/working", async () =>
    app.services.nova.getDashboardWorkingRuns()
  );
  app.get("/dashboard/activity", async () =>
    app.services.nova.getDashboardActivity()
  );
  app.get("/dashboard/attention", async () =>
    app.services.nova.getDashboardAttention()
  );
  app.get("/monitor/summary", async () => app.services.nova.getMonitorSummary());
  app.get("/monitor/active-runs", async () =>
    app.services.nova.getMonitorActiveRuns()
  );
  app.get("/monitor/recent-failures", async () =>
    app.services.nova.getMonitorRecentFailures()
  );
};
