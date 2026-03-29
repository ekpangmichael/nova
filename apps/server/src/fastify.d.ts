import "fastify";
import type { AppServices } from "./services/types.js";

declare module "fastify" {
  interface FastifyInstance {
    services: AppServices;
  }
}
