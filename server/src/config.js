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

  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-opus-5-5"),

  FREE_ACTIVE_GOALS: z.coerce.number().default(1),
  FREE_AI_PLANS_PER_MONTH: z.coerce.number().default(3)
});

export const config = schema.parse(process.env);
export const isProd = config.NODE_ENV === "production";

if (isProd && config.JWT_SECRET === "dev-jwt-secret-change-me") {
  throw new Error("JWT_SECRET must be set in production");
}
