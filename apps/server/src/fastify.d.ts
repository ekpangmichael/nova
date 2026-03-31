import "fastify";
import type { AppServices } from "./services/types.js";
import type { AuthSession } from "./services/AuthService.js";

declare module "fastify" {
  interface FastifyInstance {
    services: AppServices;
  }

  interface FastifyRequest {
    authSession: AuthSession | null;
  }
}
