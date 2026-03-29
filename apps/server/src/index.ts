import { createApp } from "./app.js";

const main = async () => {
  const { app, env } = await createApp();

  const shutdown = async () => {
    await app.close();
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void shutdown().finally(() => {
        process.exit(0);
      });
    });
  }

  try {
    await app.listen({
      host: env.host,
      port: env.port,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void main();
