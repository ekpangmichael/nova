import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import { createDatabaseContext, migrateDatabase } from "@nova/db";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { loadEnv, type AppEnv } from "./env.js";
import { ApiError, unauthorized } from "./lib/errors.js";
import { apiRoutes } from "./routes/api.js";
import { AuthService } from "./services/AuthService.js";
import { NovaService } from "./services/NovaService.js";
import { RuntimeManager } from "./services/runtime/RuntimeManager.js";
import type { AppServices } from "./services/types.js";
import { WebsocketHub } from "./services/websocket/WebsocketHub.js";

type CreateAppOptions = {
  envOverrides?: Partial<NodeJS.ProcessEnv>;
  logger?: boolean | FastifyBaseLogger;
};

const AUTH_COOKIE_NAME = "nova_session";

export type AppContext = {
  app: FastifyInstance;
  env: AppEnv;
  services: AppServices;
};

const readSessionToken = (value: string | string[] | undefined) =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const readCookieValue = (cookieHeader: string | undefined, name: string) => {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
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
  const auth = new AuthService(database.db);
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
    auth,
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
      files: 10,
      fileSize: 25 * 1024 * 1024,
    },
  });

  await app.register(websocket);

  app.get("/ws", { websocket: true }, async (socket, request) => {
    if (env.nodeEnv !== "test") {
      const sessionToken =
        readSessionToken(request.headers["x-nova-session-token"]) ??
        readCookieValue(request.headers.cookie, AUTH_COOKIE_NAME);

      if (!sessionToken) {
        socket.close(1008, "Authentication required.");
        return;
      }

      await services.auth.getSessionByToken(sessionToken);
    }

    services.websocketHub.handleConnection(socket);
  });

  app.addHook("preHandler", async (request) => {
    request.authSession = null;

    if (env.nodeEnv === "test") {
      return;
    }

    if (request.method === "OPTIONS") {
      return;
    }

    const publicPaths = ["/api/auth", "/api/health"];
    if (publicPaths.some((path) => request.url.startsWith(path))) {
      return;
    }

    const sessionToken =
      readSessionToken(request.headers["x-nova-session-token"]) ??
      readCookieValue(request.headers.cookie, AUTH_COOKIE_NAME);

    if (!sessionToken) {
      throw unauthorized("Authentication required.");
    }

    request.authSession = await services.auth.getSessionByToken(sessionToken);
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
    await services.runtimeManager.close();
    await database.close();
  });

  return {
    app,
    env,
    services,
  };
};
