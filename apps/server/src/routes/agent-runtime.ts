import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import { ApiError, badRequest } from "../lib/errors.js";
import { parseOrThrow } from "../lib/http.js";

const paramsSchema = z.object({
  taskId: z.string().uuid(),
});

const commentSchema = z.object({
  body: z.string().min(1),
});

const checkpointSchema = z.object({
  state: z.enum(["working", "blocked", "needs_input"]),
  summary: z.string().min(1),
  details: z.string().nullable().optional(),
});

const artifactSchema = z.object({
  kind: z.enum(["input", "output", "modified", "other"]),
  path: z.string().min(1),
  label: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
});

const readBearerToken = (authorizationHeader: string | undefined) => {
  if (!authorizationHeader) {
    throw new ApiError(401, "unauthorized", "Missing Authorization header.");
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);

  if (!match?.[1]?.trim()) {
    throw badRequest("Authorization header must use Bearer token auth.");
  }

  return match[1].trim();
};

export const agentRuntimeRoutes: FastifyPluginAsync = async (app) => {
  app.post("/agent-runtime/tasks/:taskId/comments", async (request) => {
    const { taskId } = parseOrThrow(paramsSchema, request.params);
    const body = parseOrThrow(commentSchema, request.body);
    const token = readBearerToken(request.headers.authorization);
    return app.services.nova.addAgentRuntimeComment(taskId, token, body);
  });

  app.post("/agent-runtime/tasks/:taskId/checkpoints", async (request) => {
    const { taskId } = parseOrThrow(paramsSchema, request.params);
    const body = parseOrThrow(checkpointSchema, request.body);
    const token = readBearerToken(request.headers.authorization);
    return app.services.nova.addAgentRuntimeCheckpoint(taskId, token, body);
  });

  app.post("/agent-runtime/tasks/:taskId/artifacts", async (request) => {
    const { taskId } = parseOrThrow(paramsSchema, request.params);
    const body = parseOrThrow(artifactSchema, request.body);
    const token = readBearerToken(request.headers.authorization);
    return app.services.nova.addAgentRuntimeArtifact(taskId, token, body);
  });
};
