process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL || "postgres://app@127.0.0.1:5433/lifeos_test";
delete process.env.ANTHROPIC_API_KEY; // tests use the template planner, never the real API

const { default: request } = await import("supertest");
const { createApp } = await import("../src/app.js");
const { migrate } = await import("../src/db/migrate.js");
const { pool } = await import("../src/db/pool.js");
const { ensureAdmin } = await import("../src/services/bootstrap.js");

export { pool };
export const app = createApp();
export const api = () => request(app);

export async function resetDb() {
  // Fire-and-forget activity writes from the previous suite can deadlock with the DROP; retry.
  for (let attempt = 0; ; attempt++) {
    try {
      await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
      break;
    } catch (err) {
      if (err.code !== "40P01" || attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  await migrate();
}

let n = 0;
export async function signup(email = `user${++n}@example.com`, password = "password123") {
  const res = await api().post("/api/auth/register").send({ email, password }).expect(201);
  return { token: res.body.token, user: res.body.user, auth: { Authorization: `Bearer ${res.body.token}` } };
}

export async function adminSession() {
  await ensureAdmin("admin@example.com", "admin-password-123");
  const res = await api()
    .post("/api/auth/login")
    .send({ email: "admin@example.com", password: "admin-password-123" })
    .expect(200);
  return { auth: { Authorization: `Bearer ${res.body.token}` }, user: res.body.user };
}
