import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Symmetric encryption for integration credentials stored in the database.
 * The master key (APP_ENCRYPTION_KEY) is the one secret that must live in the
 * environment — it never touches the database. Everything it protects (bot
 * tokens, API keys) is entered through the admin UI and stored encrypted.
 */
function masterKey() {
  const raw = process.env.APP_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("APP_ENCRYPTION_KEY is not configured");
  return createHash("sha256").update(raw).digest(); // 32 bytes for AES-256
}

export function isEncryptionConfigured() {
  return Boolean(process.env.APP_ENCRYPTION_KEY?.trim());
}

export function encryptSecret(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(payload: string) {
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) throw new Error("Malformed secret payload");
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

/** Show enough to recognise a value without revealing it. */
export function maskSecret(plaintext: string) {
  if (plaintext.length <= 8) return "••••";
  return `${plaintext.slice(0, 4)}••••${plaintext.slice(-4)}`;
}
