import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import { parseOrThrow } from "../lib/http.js";

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  slug: z.string().optional(),
  status: z.enum(["active", "paused", "archived"]).optional(),
  projectRoot: z.string().min(1),
  seedType: z.enum(["none", "git"]).optional(),
  seedUrl: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

const patchProjectSchema = createProjectSchema.partial();

const paramsSchema = z.object({
  projectId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
});

export const projectRoutes: FastifyPluginAsync = async (app) => {
  app.get("/projects", async () => app.services.nova.listProjects());

  app.post("/projects", async (request) => {
    const body = parseOrThrow(createProjectSchema, request.body);
    return app.services.nova.createProject(body);
  });

  app.get("/projects/:projectId", async (request) => {
    const { projectId } = parseOrThrow(paramsSchema, request.params);
    return app.services.nova.getProject(projectId);
  });

  app.patch("/projects/:projectId", async (request) => {
    const { projectId } = parseOrThrow(paramsSchema, request.params);
    const body = parseOrThrow(patchProjectSchema, request.body);
    return app.services.nova.patchProject(projectId, body);
  });

  app.post("/projects/:projectId/agents/:agentId", async (request) => {
    const { projectId, agentId } = parseOrThrow(paramsSchema, request.params);
    return app.services.nova.assignAgentToProject(projectId, agentId!);
  });

  app.delete("/projects/:projectId/agents/:agentId", async (request, reply) => {
    const { projectId, agentId } = parseOrThrow(paramsSchema, request.params);
    await app.services.nova.unassignAgentFromProject(projectId, agentId!);
    return reply.code(204).send();
  });

  app.get("/projects/:projectId/activity", async (request) => {
    const { projectId } = parseOrThrow(paramsSchema, request.params);
    return app.services.nova.getProjectActivity(projectId);
  });
};
