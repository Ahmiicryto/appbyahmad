import { createApp } from "./app.js";
import { config } from "./config.js";
import { migrate } from "./db/migrate.js";
import { ensureAdmin } from "./services/bootstrap.js";
import { logger } from "./logger.js";

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
