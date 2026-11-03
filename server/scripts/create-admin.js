// Usage: npm run create-admin -- you@example.com "a-long-password"
import { migrate } from "../src/db/migrate.js";
import { pool } from "../src/db/pool.js";
import { ensureAdmin } from "../src/services/bootstrap.js";

const [email, password] = process.argv.slice(2);
if (!email) {
  console.error('Usage: npm run create-admin -- you@example.com "a-long-password"');
  process.exit(1);
}
await migrate();
const id = await ensureAdmin(email, password);
console.log(id ? `Admin ready: ${email}` : "Admin not created (password must be at least 12 characters).");
await pool.end();
