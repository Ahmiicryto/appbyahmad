import { createApp } from "./app.js";
import { config } from "./config.js";
import { migrate } from "./db/migrate.js";
import { ensureAdmin } from "./services/bootstrap.js";
import { logger } from "./logger.js";

await migrate();
await ensureAdmin();

createApp().listen(config.PORT, () => logger.info({ port: config.PORT }, "server listening"));
