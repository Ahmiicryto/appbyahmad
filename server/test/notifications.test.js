import assert from "node:assert/strict";
import { after, afterEach, before, describe, test } from "node:test";
import { adminSession, api, pool, resetDb, signup } from "./helpers.js";
import { notifyUser, notifyUsers, resolveAudience } from "../src/services/notify.js";
import { setPushTransportForTests } from "../src/services/push.js";

before(resetDb);
afterEach(() => setPushTransportForTests(null));
after(() => pool.end());

const tok = (s) => `ExponentPushToken[${s.padEnd(12, "x")}]`;

// Records every chunk sent; marks tokens listed in `dead` as DeviceNotRegistered.
function fakeTransport(dead = []) {
  const calls = [];
  setPushTransportForTests(async (messages, opts) => {
    calls.push({ messages, opts });
    return {
      data: messages.map((m) =>
        dead.includes(m.to) ? { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } } : { status: "ok", id: "t" }
      )
    };
  });
  return calls;
}

describe("inbox", () => {
  test("list, unread count, mark read, read all, isolation", async () => {
    const a = await signup();
    const b = await signup();
    await notifyUser(a.user.id, { title: "One", body: "First", data: { url: "/goals" } }, { push: false });
    await notifyUser(a.user.id, { title: "Two", body: "Second" }, { push: false });
    await notifyUser(b.user.id, { title: "B only", body: "Hi" }, { push: false });

    let r = await api().get("/api/notifications").set(a.auth).expect(200);
    assert.equal(r.body.notifications.length, 2);
    assert.equal(r.body.notifications[0].title, "Two");
    assert.equal(r.body.notifications[0].read, false);
    assert.equal(r.body.unread, 2);
    assert.equal(r.body.notifications[1].data.url, "/goals");

    r = await api().get("/api/notifications/unread-count").set(a.auth).expect(200);
    assert.equal(r.body.count, 2);

    const id = (await api().get("/api/notifications").set(a.auth)).body.notifications[1].id;
    // Someone else can't read or mark it.
    await api().post(`/api/notifications/${id}/read`).set(b.auth).expect(404);
    await api().post("/api/notifications/nope/read").set(a.auth).expect(404);
    r = await api().post(`/api/notifications/${id}/read`).set(a.auth).expect(200);
    assert.equal(r.body.unread, 1);
    const ev = await pool.query("SELECT 1 FROM activity_events WHERE user_id = $1 AND type = 'notification.opened'", [a.user.id]);
    assert.equal(ev.rowCount, 1);

    await api().post("/api/notifications/read-all").set(a.auth).expect(200);
    r = await api().get("/api/notifications/unread-count").set(a.auth).expect(200);
    assert.equal(r.body.count, 0);

    r = await api().get("/api/notifications").set(b.auth).expect(200);
    assert.equal(r.body.notifications.length, 1);
    assert.equal(r.body.unread, 1);
  });

  test("requires sign-in", async () => {
    await api().get("/api/notifications").expect(401);
  });
});

describe("preferences", () => {
  test("defaults on, partial update, validation", async () => {
    const { auth } = await signup();
    let r = await api().get("/api/notifications/preferences").set(auth).expect(200);
    assert.deepEqual(r.body.preferences, { push: true, reminders: true, announcements: true });
    r = await api().patch("/api/notifications/preferences").set(auth).send({ push: false }).expect(200);
    assert.deepEqual(r.body.preferences, { push: false, reminders: true, announcements: true });
    r = await api().get("/api/notifications/preferences").set(auth).expect(200);
    assert.equal(r.body.preferences.push, false);
    await api().patch("/api/notifications/preferences").set(auth).send({ push: "no" }).expect(400);
    await api().patch("/api/notifications/preferences").set(auth).send({ email: true }).expect(400);
    await api().patch("/api/notifications/preferences").set(auth).send({}).expect(400);
  });
});

describe("push tokens", () => {
  test("register, reassign, delete, bad token", async () => {
    const a = await signup();
    const b = await signup();
    const t = tok("device1");
    await api().post("/api/notifications/push-tokens").set(a.auth).send({ token: t, platform: "ios" }).expect(201);
    await api().post("/api/notifications/push-tokens").set(a.auth).send({ token: t, platform: "ios" }).expect(201);
    let rows = (await pool.query("SELECT user_id FROM push_tokens WHERE token = $1", [t])).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, a.user.id);

    await api().post("/api/notifications/push-tokens").set(b.auth).send({ token: t }).expect(201);
    rows = (await pool.query("SELECT user_id, platform FROM push_tokens WHERE token = $1", [t])).rows;
    assert.equal(rows[0].user_id, b.user.id);
    assert.equal(rows[0].platform, "ios");

    // A can't delete B's token.
    let r = await api().delete("/api/notifications/push-tokens").set(a.auth).send({ token: t }).expect(200);
    assert.equal(r.body.removed, 0);
    r = await api().delete("/api/notifications/push-tokens").set(b.auth).send({ token: t }).expect(200);
    assert.equal(r.body.removed, 1);

    await api().post("/api/notifications/push-tokens").set(a.auth).send({ token: "abc123" }).expect(400);
    await api().post("/api/notifications/push-tokens").set(a.auth).send({ token: tok("ok12345"), platform: "symbian" }).expect(400);
    await api().post("/api/notifications/push-tokens").set(a.auth).send({ token: "ExpoPushToken[abcdefghijkl]" }).expect(201);
  });
});

describe("push service", () => {
  test("notifyUsers pushes in chunks, honors prefs, removes dead tokens", async () => {
    const users = [];
    for (let i = 0; i < 3; i++) users.push(await signup());
    // 105 tokens for user 0 to force two chunks.
    const many = Array.from({ length: 105 }, (_, i) => tok(`bulk${i}`));
    await pool.query("INSERT INTO push_tokens (user_id, token) SELECT $1, unnest($2::text[])", [users[0].user.id, many]);
    await pool.query("INSERT INTO push_tokens (user_id, token) VALUES ($1, $2), ($3, $4)", [
      users[1].user.id, tok("dead1"), users[2].user.id, tok("off1")
    ]);
    await api().patch("/api/notifications/preferences").set(users[2].auth).send({ push: false }).expect(200);

    const calls = fakeTransport([tok("dead1")]);
    const out = await notifyUsers(users.map((u) => u.user.id), { title: "Hi", body: "There" });
    assert.equal(out.recipients, 3);
    assert.equal(calls.length, 2);
    assert.ok(calls.every((c) => c.messages.length <= 100));
    const sentTo = calls.flatMap((c) => c.messages.map((m) => m.to));
    assert.equal(sentTo.length, 106);
    assert.ok(!sentTo.includes(tok("off1")));
    assert.deepEqual(out.push, { sent: 105, failed: 1 });
    const dead = await pool.query("SELECT 1 FROM push_tokens WHERE token = $1", [tok("dead1")]);
    assert.equal(dead.rowCount, 0);
  });

  test("transport failure never throws", async () => {
    const u = await signup();
    await pool.query("INSERT INTO push_tokens (user_id, token) VALUES ($1, $2)", [u.user.id, tok("boom1")]);
    setPushTransportForTests(async () => {
      throw new Error("network down");
    });
    const out = await notifyUser(u.user.id, { title: "x", body: "y" });
    assert.equal(out.recipients, 1);
    assert.deepEqual(out.push, { sent: 0, failed: 1 });
  });
});

describe("admin notifications", () => {
  let admin;
  let users;
  before(async () => {
    await resetDb();
    admin = await adminSession();
    users = {
      free1: await signup("free1@example.com"),
      free2: await signup("free2@example.com"),
      prem: await signup("prem@example.com"),
      susp: await signup("susp@example.com")
    };
    await pool.query("UPDATE users SET plan = 'premium' WHERE email = 'prem@example.com'");
    await pool.query("UPDATE users SET status = 'suspended' WHERE email = 'susp@example.com'");
    await pool.query("UPDATE users SET last_seen_at = now() - interval '20 days' WHERE email = 'free2@example.com'");
    await pool.query("UPDATE users SET last_seen_at = now() WHERE email IN ('free1@example.com', 'prem@example.com', 'admin@example.com')");
    await pool.query("UPDATE profiles SET theme = 'female' WHERE user_id = $1", [users.free1.user.id]);
    await pool.query("INSERT INTO push_tokens (user_id, token) VALUES ($1, $2), ($3, $4), ($5, $6), ($7, $8)", [
      users.free1.user.id, tok("f1"), users.free2.user.id, tok("f2"), users.prem.user.id, tok("p1"), users.susp.user.id, tok("s1")
    ]);
  });

  const preview = (audience) => api().post("/api/admin/notifications/preview").set(admin.auth).send({ audience }).expect(200);

  test("non-admin gets 403", async () => {
    await api().post("/api/admin/notifications/preview").set(users.free1.auth).send({ audience: { type: "all" } }).expect(403);
    await api().get("/api/admin/notifications/campaigns").set(users.free1.auth).expect(403);
  });

  test("preview counts per audience type", async () => {
    // admin + free1 + free2 + prem (suspended excluded)
    let r = await preview({ type: "all" });
    assert.deepEqual(r.body, { recipients: 4, withPush: 3 });
    r = await preview({ type: "plan", plan: "free" });
    assert.equal(r.body.recipients, 3);
    r = await preview({ type: "plan", plan: "premium" });
    assert.deepEqual(r.body, { recipients: 1, withPush: 1 });
    r = await preview({ type: "user", email: "FREE2@example.com" });
    assert.equal(r.body.recipients, 1);
    r = await preview({ type: "user", email: "susp@example.com" });
    assert.equal(r.body.recipients, 0);
    r = await preview({ type: "inactive", days: 7 });
    assert.equal(r.body.recipients, 1);
    r = await preview({ type: "theme", theme: "female" });
    assert.equal(r.body.recipients, 1);
    r = await preview({ type: "theme", theme: "neutral" });
    assert.equal(r.body.recipients, 3);
    await api().post("/api/admin/notifications/preview").set(admin.auth).send({ audience: { type: "inactive", days: 0 } }).expect(400);
    await api().post("/api/admin/notifications/preview").set(admin.auth).send({ audience: { type: "everyone" } }).expect(400);
    assert.equal((await resolveAudience({ type: "plan", plan: "premium" }))[0], users.prem.user.id);
  });

  test("send creates inbox rows, pushes, cleans dead tokens, respects prefs", async () => {
    await api().patch("/api/notifications/preferences").set(users.free2.auth).send({ announcements: false }).expect(200);
    const calls = fakeTransport([tok("f1")]);
    const r = await api()
      .post("/api/admin/notifications/send")
      .set(admin.auth)
      .send({ title: "New: Goals", body: "Try the new goal planner.", url: "/goals", audience: { type: "plan", plan: "free" }, send_push: true })
      .expect(201);
    const c = r.body.campaign;
    assert.equal(c.status, "sent");
    assert.equal(c.recipients, 3);
    assert.equal(c.push_sent, 0);
    assert.equal(c.push_failed, 1);

    const sentTo = calls.flatMap((x) => x.messages.map((m) => m.to));
    assert.deepEqual(sentTo, [tok("f1")]); // free2 turned off announcements, prem not in audience
    assert.equal(calls[0].messages[0].data.url, "/goals");
    assert.equal((await pool.query("SELECT 1 FROM push_tokens WHERE token = $1", [tok("f1")])).rowCount, 0);

    const inbox = await api().get("/api/notifications").set(users.free2.auth).expect(200);
    assert.equal(inbox.body.notifications[0].title, "New: Goals");
    assert.equal(inbox.body.notifications[0].kind, "announcement");
    const premInbox = await api().get("/api/notifications").set(users.prem.auth).expect(200);
    assert.equal(premInbox.body.notifications.length, 0);

    const aud = await pool.query("SELECT 1 FROM audit_log WHERE action = 'notification.sent' AND target_id = $1", [c.id]);
    assert.equal(aud.rowCount, 1);
  });

  test("send without push and push=false prefs", async () => {
    await api().patch("/api/notifications/preferences").set(users.prem.auth).send({ push: false }).expect(200);
    let calls = fakeTransport();
    await api()
      .post("/api/admin/notifications/send")
      .set(admin.auth)
      .send({ title: "Hello", body: "Premium news", audience: { type: "plan", plan: "premium" }, send_push: true })
      .expect(201);
    assert.equal(calls.length, 0);

    calls = fakeTransport();
    const r = await api()
      .post("/api/admin/notifications/send")
      .set(admin.auth)
      .send({ title: "Quiet", body: "Inbox only", audience: { type: "all" }, send_push: false })
      .expect(201);
    assert.equal(calls.length, 0);
    assert.equal(r.body.campaign.recipients, 4);
  });

  test("send validation", async () => {
    const send = (body) => api().post("/api/admin/notifications/send").set(admin.auth).send(body);
    const base = { title: "T", body: "B", audience: { type: "all" } };
    assert.equal((await send({ ...base, title: "x".repeat(66) })).status, 400);
    assert.equal((await send({ ...base, body: "x".repeat(241) })).status, 400);
    assert.equal((await send({ ...base, url: "javascript:alert(1)" })).status, 400);
    assert.equal((await send({ ...base, url: "http://example.com" })).status, 400);
    assert.equal((await send({ ...base, url: "https://example.com/x", send_push: false })).status, 201);
  });

  test("campaigns and stats", async () => {
    const r = await api().get("/api/admin/notifications/campaigns").set(admin.auth).expect(200);
    assert.ok(r.body.campaigns.length >= 3);
    assert.equal(r.body.campaigns[0].created_by_email, "admin@example.com");
    const free2 = (await api().get("/api/notifications").set(users.free2.auth)).body.notifications;
    await api().post("/api/notifications/read-all").set(users.free2.auth).expect(200);
    const s = await api().get("/api/admin/notifications/stats").set(admin.auth).expect(200);
    assert.ok(s.body.campaigns_30d >= 3);
    assert.equal(s.body.read_30d, free2.length);
    assert.ok(s.body.read_rate_30d > 0 && s.body.read_rate_30d < 1);
    assert.equal(typeof s.body.push_tokens, "number");
    assert.equal(typeof s.body.users_with_push, "number");
  });
});

describe("notification links", () => {
  test("protocol-relative links like //evil.com are rejected", async () => {
    const { auth } = await adminSession();
    const r = await api()
      .post("/api/admin/notifications/send")
      .set(auth)
      .send({ title: "Hi", body: "There", url: "//evil.com/x", audience: { type: "all" }, send_push: false });
    assert.equal(r.status, 400);
  });
});
