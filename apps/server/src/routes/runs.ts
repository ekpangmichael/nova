import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import { parseOrThrow } from "../lib/http.js";

const paramsSchema = z.object({
  runId: z.string().uuid(),
});

export const runRoutes: FastifyPluginAsync = async (app) => {
  app.get("/runs/:runId", async (request) => {
    const { runId } = parseOrThrow(paramsSchema, request.params);
    return app.services.nova.getRun(runId);
  });

  app.get("/runs/:runId/events", async (request) => {
    const { runId } = parseOrThrow(paramsSchema, request.params);
    return app.services.nova.getRunEvents(runId);
  });

  app.get("/runs/:runId/artifacts", async (request) => {
    const { runId } = parseOrThrow(paramsSchema, request.params);
    return app.services.nova.getRunArtifacts(runId);
  });
};
