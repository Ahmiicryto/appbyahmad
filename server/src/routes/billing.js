import { Router } from "express";

// STUB: filled in by the feature owner.
export const billingRouter = Router();
export function stripeWebhook(req, res) {
  res.status(501).json({ error: { code: "not_implemented", message: "Payments are not set up yet." } });
}
