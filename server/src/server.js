import { createApp } from "./app.js";
import { config } from "./config.js";
import { migrate } from "./db/migrate.js";
import { ensureAdmin } from "./services/bootstrap.js";
import { logger } from "./logger.js";
import { logError } from "./services/errorLog.js";

// Last-resort handlers: record the crash for the admin Error logs screen.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandled promise rejection");
  logError({ source: "server", level: "fatal", message: reason?.message || String(reason), stack: reason?.stack, meta: { kind: "unhandledRejection" } });
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception");
  // Give the error log write a moment, then exit so the platform restarts a clean process.
  const exit = () => process.exit(1);
  const timer = setTimeout(exit, 1000);
  Promise.resolve(
    logError({ source: "server", level: "fatal", message: err?.message || String(err), stack: err?.stack, meta: { kind: "uncaughtException" } })
  ).finally(() => {
    clearTimeout(timer);
    setTimeout(exit, 100);
  });
});

try {
  await migrate();
} catch (err) {
  // Plain-language hint for the most common deploy mistake. Never logs the password.
  let host = "(could not read DATABASE_URL)";
  try {
    host = new URL(config.DATABASE_URL).hostname || host;
  } catch {
    /* malformed URL */
  }
  logger.fatal(
    { code: err.code, host },
    `Can't connect to the database at "${host}". Check that DATABASE_URL is the full postgresql:// address of your database (on Railway: copy it from the Postgres service's Variables tab).`
  );
  process.exit(1);
}
await ensureAdmin();

createApp().listen(config.PORT, () => logger.info({ port: config.PORT }, "server listening"));
