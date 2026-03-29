import type { AppDatabase, DatabaseContext } from "@nova/db";
import type { AppEnv } from "../env.js";
import type { RuntimeManager } from "./runtime/RuntimeManager.js";
import type { WebsocketHub } from "./websocket/WebsocketHub.js";
import type { NovaService } from "./NovaService.js";

export type AppServices = {
  env: AppEnv;
  db: AppDatabase;
  sqlite: DatabaseContext["client"];
  runtimeManager: RuntimeManager;
  websocketHub: WebsocketHub;
  nova: NovaService;
};
