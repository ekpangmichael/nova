import { agentRuntimeRoutes } from "./agent-runtime.js";
import type { FastifyPluginAsync } from "fastify";
import { agentRoutes } from "./agents.js";
import { authRoutes } from "./auth.js";
import { healthRoutes } from "./health.js";
import { monitorRoutes } from "./monitor.js";
import { projectRoutes } from "./projects.js";
import { runtimeRoutes } from "./runtimes.js";
import { runRoutes } from "./runs.js";
import { systemRoutes } from "./system.js";
import { taskRoutes } from "./tasks.js";

export const apiRoutes: FastifyPluginAsync = async (app) => {
  await app.register(authRoutes);
  await app.register(healthRoutes);
  await app.register(runtimeRoutes);
  await app.register(systemRoutes);
  await app.register(agentRuntimeRoutes);
  await app.register(projectRoutes);
  await app.register(agentRoutes);
  await app.register(taskRoutes);
  await app.register(runRoutes);
  await app.register(monitorRoutes);
};
