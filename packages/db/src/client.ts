import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { schema } from "./schema.js";

export type AppDatabase = LibSQLDatabase<typeof schema>;

export type DatabaseContext = {
  client: Client;
  db: AppDatabase;
  close: () => Promise<void>;
};

export const createDatabaseContext = async (
  dbPath: string
): Promise<DatabaseContext> => {
  mkdirSync(dirname(dbPath), { recursive: true });

  const client = createClient({
    url: `file:${dbPath}`,
  });

  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA foreign_keys = ON");

  const db = drizzle(client, { schema });

  return {
    client,
    db,
    close: async () => {
      client.close();
    },
  };
};

export const migrateDatabase = async (db: AppDatabase) => {
  const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
  await migrate(db, { migrationsFolder });
};
