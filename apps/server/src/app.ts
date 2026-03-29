import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import { createDatabaseContext, migrateDatabase } from "@nova/db";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { loadEnv, type AppEnv } from "./env.js";
import { ApiError } from "./lib/errors.js";
import { apiRoutes } from "./routes/api.js";
import { NovaService } from "./services/NovaService.js";
import { RuntimeManager } from "./services/runtime/RuntimeManager.js";
import type { AppServices } from "./services/types.js";
import { WebsocketHub } from "./services/websocket/WebsocketHub.js";

type CreateAppOptions = {
  envOverrides?: Partial<NodeJS.ProcessEnv>;
  logger?: boolean | FastifyBaseLogger;
};

export type AppContext = {
  app: FastifyInstance;
  env: AppEnv;
  services: AppServices;
};

export const createApp = async (
  options: CreateAppOptions = {}
): Promise<AppContext> => {
  const env = loadEnv(options.envOverrides);
  const database = await createDatabaseContext(env.dbPath);
  await migrateDatabase(database.db);

  const app = Fastify({
    logger: options.logger ?? true,
  });

  const websocketHub = new WebsocketHub();
  const runtimeManager = new RuntimeManager(env);
  const nova = new NovaService({
    db: database.db,
    env,
    runtimeManager,
    websocketHub,
  });

  const services: AppServices = {
    env,
    db: database.db,
    sqlite: database.client,
    runtimeManager,
    websocketHub,
    nova,
  };

  await nova.bootstrap();

  app.decorate("services", services);

  await app.register(cors, {
    origin: true,
  });

  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 25 * 1024 * 1024,
    },
  });

  await app.register(websocket);

  app.get("/ws", { websocket: true }, (socket) => {
    services.websocketHub.handleConnection(socket);
  });

  await app.register(apiRoutes, {
    prefix: "/api",
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
      });
    }

    app.log.error(error);

    return reply.status(500).send({
      error: {
        code: "internal_error",
        message: "Unexpected server error.",
      },
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: {
        code: "not_found",
        message: "Route not found.",
      },
    });
  });

  app.addHook("onClose", async () => {
    await services.nova.close();
    await database.close();
  });

  return {
    app,
    env,
    services,
  };
};
