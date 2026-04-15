import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import { parseOrThrow } from "../lib/http.js";

const runtimeKindSchema = z.enum(["openclaw-native", "codex", "claude-code"]);

const createRuntimeSchema = z.object({
  kind: runtimeKindSchema.default("openclaw-native"),
  runtimeAgentId: z.string().min(1).optional(),
  workspacePath: z.string().min(1).optional(),
  runtimeStatePath: z.string().min(1).optional(),
  defaultModelId: z.string().min(1).nullable().optional(),
  modelOverrideAllowed: z.boolean().optional(),
  sandboxMode: z.enum(["off", "docker", "other"]).optional(),
  defaultThinkingLevel: z
    .enum(["off", "minimal", "low", "medium", "high", "xhigh"])
    .optional(),
});

const patchRuntimeSchema = z.object({
  kind: runtimeKindSchema.optional(),
  runtimeAgentId: z.string().min(1).optional(),
  workspacePath: z.string().min(1).optional(),
  runtimeStatePath: z.string().min(1).optional(),
  defaultModelId: z.string().min(1).nullable().optional(),
  modelOverrideAllowed: z.boolean().optional(),
  sandboxMode: z.enum(["off", "docker", "other"]).optional(),
  defaultThinkingLevel: z
    .enum(["off", "minimal", "low", "medium", "high", "xhigh"])
    .optional(),
});

const createAgentSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  slug: z.string().optional(),
  avatar: z.string().nullable().optional(),
  systemInstructions: z.string().optional(),
  personaText: z.string().nullable().optional(),
  userContextText: z.string().nullable().optional(),
  identityText: z.string().nullable().optional(),
  toolsText: z.string().nullable().optional(),
  heartbeatText: z.string().nullable().optional(),
  memoryText: z.string().nullable().optional(),
  runtime: createRuntimeSchema.optional(),
});

const importOpenClawAgentSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  slug: z.string().optional(),
  avatar: z.string().nullable().optional(),
  systemInstructions: z.string().optional(),
  personaText: z.string().nullable().optional(),
  userContextText: z.string().nullable().optional(),
  identityText: z.string().nullable().optional(),
  toolsText: z.string().nullable().optional(),
  heartbeatText: z.string().nullable().optional(),
  memoryText: z.string().nullable().optional(),
  runtime: z.object({
    runtimeAgentId: z.string().min(1),
    defaultModelId: z.string().min(1).nullable().optional(),
    modelOverrideAllowed: z.boolean().optional(),
    sandboxMode: z.enum(["off", "docker", "other"]).optional(),
    defaultThinkingLevel: z
      .enum(["off", "minimal", "low", "medium", "high", "xhigh"])
      .optional(),
  }),
});

const patchAgentSchema = createAgentSchema.partial().extend({
  runtime: patchRuntimeSchema.optional(),
  status: z.enum(["idle", "working", "paused", "error", "offline"]).optional(),
});

const paramsSchema = z.object({
  agentId: z.string().uuid(),
});

export const agentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/agents", async () => app.services.nova.listAgents());

  app.post("/agents", async (request) => {
    const body = parseOrThrow(createAgentSchema, request.body);
    return app.services.nova.createAgent(body);
  });

  app.post("/agents/import/openclaw", async (request) => {
    const body = parseOrThrow(importOpenClawAgentSchema, request.body);
    return app.services.nova.importOpenClawAgent(body);
  });

  app.get("/agents/:agentId", async (request) => {
    const { agentId } = parseOrThrow(paramsSchema, request.params);
    return app.services.nova.getAgent(agentId);
  });

  app.patch("/agents/:agentId", async (request) => {
    const { agentId } = parseOrThrow(paramsSchema, request.params);
    const body = parseOrThrow(patchAgentSchema, request.body);
    return app.services.nova.patchAgent(agentId, body);
  });

  app.delete("/agents/:agentId", async (request, reply) => {
    const { agentId } = parseOrThrow(paramsSchema, request.params);
    await app.services.nova.deleteAgent(agentId);
    return reply.code(204).send();
  });

  app.post("/agents/:agentId/sync-home", async (request) => {
    const { agentId } = parseOrThrow(paramsSchema, request.params);
    return app.services.nova.syncAgentHome(agentId);
  });

  app.get("/agents/:agentId/tasks", async (request) => {
    const { agentId } = parseOrThrow(paramsSchema, request.params);
    return app.services.nova.getAgentTasks(agentId);
  });

  app.get("/agents/:agentId/runs", async (request) => {
    const { agentId } = parseOrThrow(paramsSchema, request.params);
    return app.services.nova.getAgentRuns(agentId);
  });
};
