import crypto from "node:crypto";
import { config, isProd } from "../config.js";

// AES-256-GCM for private text (journal entries). Format: v1:<iv>:<tag>:<ciphertext>, all base64.
// ENCRYPTION_KEY is either 32 bytes in base64, or any passphrase of 32+ characters (hashed to 32 bytes).
let cachedKey;
function key() {
  if (cachedKey) return cachedKey;
  const raw = config.ENCRYPTION_KEY;
  if (raw) {
    const b = Buffer.from(raw, "base64");
    cachedKey = /^[A-Za-z0-9+/]{43}=$/.test(raw) && b.length === 32 ? b : crypto.createHash("sha256").update(raw).digest();
  } else {
    if (isProd) throw new Error("ENCRYPTION_KEY must be set in production");
    cachedKey = crypto.createHash("sha256").update("dev-only-encryption-key").digest();
  }
  return cachedKey;
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
