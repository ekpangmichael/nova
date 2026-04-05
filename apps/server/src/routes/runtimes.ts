import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import { parseOrThrow } from "../lib/http.js";

const openClawConfigSchema = z.object({
  profile: z.string().min(1),
  binaryPath: z.string().nullable().optional(),
  stateDir: z.string().nullable().optional(),
  configPath: z.string().nullable().optional(),
  gatewayUrl: z.string().nullable().optional(),
});

const codexConfigSchema = z.object({
  binaryPath: z.string().nullable().optional(),
  stateDir: z.string().nullable().optional(),
  configPath: z.string().nullable().optional(),
  defaultModel: z.string().nullable().optional(),
});

const claudeConfigSchema = z.object({
  binaryPath: z.string().nullable().optional(),
  stateDir: z.string().nullable().optional(),
  configPath: z.string().nullable().optional(),
  defaultModel: z.string().nullable().optional(),
});

const runtimeEnabledSchema = z.object({
  enabled: z.boolean(),
});

export const runtimeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/runtimes", async () => app.services.nova.listRuntimes());

  app.get("/runtimes/openclaw/catalog", async () =>
    app.services.nova.getOpenClawCatalog()
  );

  app.get("/runtimes/openclaw/config", async () =>
    app.services.nova.getOpenClawConfig()
  );

  app.post("/runtimes/openclaw/config/test", async (request) => {
    const body = parseOrThrow(openClawConfigSchema, request.body);
    return app.services.nova.testOpenClawConfig(body);
  });

  app.patch("/runtimes/openclaw/config", async (request) => {
    const body = parseOrThrow(openClawConfigSchema, request.body);
    return app.services.nova.updateOpenClawConfig(body);
  });

  app.patch("/runtimes/openclaw/enabled", async (request) => {
    const body = parseOrThrow(runtimeEnabledSchema, request.body);
    return app.services.nova.setOpenClawEnabled(body.enabled);
  });

  app.get("/runtimes/codex/config", async () =>
    app.services.nova.getCodexConfig()
  );

  app.get("/runtimes/codex/catalog", async () =>
    app.services.nova.getCodexCatalog()
  );

  app.post("/runtimes/codex/config/test", async (request) => {
    const body = parseOrThrow(codexConfigSchema, request.body);
    return app.services.nova.testCodexConfig(body);
  });

  app.patch("/runtimes/codex/config", async (request) => {
    const body = parseOrThrow(codexConfigSchema, request.body);
    return app.services.nova.updateCodexConfig(body);
  });

  app.patch("/runtimes/codex/enabled", async (request) => {
    const body = parseOrThrow(runtimeEnabledSchema, request.body);
    return app.services.nova.setCodexEnabled(body.enabled);
  });

  app.get("/runtimes/claude/config", async () =>
    app.services.nova.getClaudeConfig()
  );

  app.get("/runtimes/claude/catalog", async () =>
    app.services.nova.getClaudeCatalog()
  );

  app.post("/runtimes/claude/config/test", async (request) => {
    const body = parseOrThrow(claudeConfigSchema, request.body);
    return app.services.nova.testClaudeConfig(body);
  });

  app.patch("/runtimes/claude/config", async (request) => {
    const body = parseOrThrow(claudeConfigSchema, request.body);
    return app.services.nova.updateClaudeConfig(body);
  });

  app.patch("/runtimes/claude/enabled", async (request) => {
    const body = parseOrThrow(runtimeEnabledSchema, request.body);
    return app.services.nova.setClaudeEnabled(body.enabled);
  });
};
