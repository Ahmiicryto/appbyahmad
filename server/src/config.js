import { z } from "zod";

const bool = (def) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? def : ["1", "true", "yes", "on"].includes(v.toLowerCase())));

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().default("postgres://app@127.0.0.1:5433/lifeos"),
  DATABASE_SSL: bool(false),
  JWT_SECRET: z.string().default("dev-jwt-secret-change-me"),
  JWT_TTL: z.string().default("30d"),
  // 32 random bytes, base64. Encrypts journal entries at rest. Never change it after data exists.
  ENCRYPTION_KEY: z.string().optional(),
  ALLOW_SIGNUP: bool(true),
  CORS_ORIGINS: z.string().default(""),

  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  // Set to true for one deploy to replace the admin's password with ADMIN_PASSWORD, then remove it.
  ADMIN_RESET_PASSWORD: bool(false),

  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-opus-5-5"),

  FREE_ACTIVE_GOALS: z.coerce.number().default(1),
  FREE_AI_PLANS_PER_MONTH: z.coerce.number().default(3)
});

export const config = schema.parse(process.env);
export const isProd = config.NODE_ENV === "production";

// Fail at deploy time with a clear message instead of on the first sign-in or journal entry.
if (isProd && (config.JWT_SECRET === "dev-jwt-secret-change-me" || config.JWT_SECRET.length < 32)) {
  throw new Error("JWT_SECRET must be set to a random string of at least 32 characters");
}
if (isProd && (!config.ENCRYPTION_KEY || config.ENCRYPTION_KEY.length < 32)) {
  throw new Error("ENCRYPTION_KEY must be set to a random string of at least 32 characters");
}
