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
import { adminBillingRouter } from "./routes/adminBilling.js";
import { adminInsightsRouter } from "./routes/adminInsights.js";
import { adminActivityRouter, adminErrorsRouter } from "./routes/adminMonitoring.js";
import { adminNotificationsRouter } from "./routes/adminNotifications.js";
import { adminSettingsRouter } from "./routes/adminSettings.js";
import { appConfigRouter } from "./routes/appConfig.js";
import { billingRouter, revenuecatWebhook, stripeWebhook } from "./routes/billing.js";
import { clientErrorsRouter } from "./routes/clientErrors.js";
import { notificationsRouter } from "./routes/notifications.js";
import { maintenanceGate } from "./middleware/maintenance.js";

const adminDist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "admin", "dist");

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: { directives: { "script-src": ["'self'"] } } }));
  app.use(compression());
  // Stripe signs the raw body, so the webhook must be mounted before the JSON parser.
  app.post("/api/billing/webhook", express.raw({ type: "application/json", limit: "1mb" }), stripeWebhook);
  app.use(express.json({ limit: "200kb" }));
  // Store purchases keep working during maintenance, like the Stripe webhook.
  app.post("/api/billing/revenuecat/webhook", revenuecatWebhook);

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
  app.use("/api/app-config", appConfigRouter);
  app.use("/api/client-errors", clientErrorsRouter);
  app.use("/api", maintenanceGate);
  app.use("/api/auth", authRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api/goals", goalsRouter);
  app.use("/api/journal", journalRouter);
  app.use("/api/billing", billingRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api", tasksRouter);
  app.use("/api/admin/billing", adminBillingRouter);
  app.use("/api/admin/insights", adminInsightsRouter);
  app.use("/api/admin/activity", adminActivityRouter);
  app.use("/api/admin/errors", adminErrorsRouter);
  app.use("/api/admin/notifications", adminNotificationsRouter);
  app.use("/api/admin/settings", adminSettingsRouter);
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
