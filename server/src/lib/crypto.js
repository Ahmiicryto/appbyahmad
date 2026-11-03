import crypto from "node:crypto";
import { config, isProd } from "../config.js";

// AES-256-GCM for private text (journal entries). Format: v1:<iv>:<tag>:<ciphertext>, all base64.
function key() {
  if (config.ENCRYPTION_KEY) {
    const k = Buffer.from(config.ENCRYPTION_KEY, "base64");
    if (k.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes, base64-encoded");
    return k;
  }
  if (isProd) throw new Error("ENCRYPTION_KEY must be set in production");
  return crypto.createHash("sha256").update("dev-only-encryption-key").digest();
}

export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decrypt(blob) {
  const [v, iv, tag, data] = blob.split(":");
  if (v !== "v1") throw new Error("unknown ciphertext version");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
