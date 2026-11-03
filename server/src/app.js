import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { errorHandler, notFound } from "./lib/errors.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { goalsRouter } from "./routes/goals.js";
import { journalRouter } from "./routes/journal.js";
import { profileRouter } from "./routes/profile.js";
import { tasksRouter } from "./routes/tasks.js";

const adminDist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "admin", "dist");

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: { directives: { "script-src": ["'self'"] } } }));
  app.use(compression());
  app.use(express.json({ limit: "200kb" }));

  // The phone app calls the API directly (no browser CORS). Only listed web origins get CORS headers.
  const origins = config.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  if (origins.length) {
    app.use((req, res, next) => {
      const origin = req.get("origin");
      if (origin && origins.includes(origin)) {
        res.set({
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
          Vary: "Origin"
        });
        if (req.method === "OPTIONS") return res.status(204).end();
      }
      next();
    });
  }

  app.get("/healthz", (req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/goals", goalsRouter);
  app.use("/api/journal", journalRouter);
  app.use("/api", tasksRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", (req, res, next) => next(notFound("No such API route.")));

  // Admin dashboard (built React app) at /admin.
  if (fs.existsSync(adminDist)) {
    app.use("/admin", express.static(adminDist, { index: false, maxAge: "1h" }));
    app.get(/^\/admin(\/.*)?$/, (req, res) => res.sendFile(path.join(adminDist, "index.html")));
  }
  app.get("/", (req, res) => res.redirect("/admin"));

  app.use(errorHandler);
  return app;
}
