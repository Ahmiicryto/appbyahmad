import { ZodError } from "zod";
import { logger } from "../logger.js";

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (msg, code = "bad_request") => new HttpError(400, msg, code);
export const unauthorized = (msg = "Please sign in again.") => new HttpError(401, msg, "unauthorized");
export const forbidden = (msg = "You don't have access to this.") => new HttpError(403, msg, "forbidden");
export const notFound = (msg = "Not found.") => new HttpError(404, msg, "not_found");
export const paymentRequired = (msg, code = "upgrade_required") => new HttpError(402, msg, code);

// Express error handler: one consistent JSON shape for the app and the admin.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: "validation_error", message: "Some fields need fixing.", fields: err.flatten().fieldErrors }
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "bad_json", message: "Request body is not valid JSON." } });
  }
  logger.error({ err, path: req.path }, "unhandled error");
  res.status(500).json({ error: { code: "server_error", message: "Something went wrong. Try again." } });
}
