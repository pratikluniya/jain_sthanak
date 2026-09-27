// AES-256-GCM encryption for Aadhaar numbers. Key: 64 hex chars in AADHAAR_ENC_KEY.
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function key(): Buffer {
  const k = process.env.AADHAAR_ENC_KEY || "";
  if (!/^[0-9a-f]{64}$/i.test(k)) throw new Error("AADHAAR_ENC_KEY must be 64 hex characters");
  return Buffer.from(k, "hex");
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decrypt(blob: string): string {
  const [iv, tag, data] = blob.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}

/** 12 digits, Devanagari digits allowed. Returns null if invalid. */
export function cleanAadhaar(raw: string): string | null {
  const d = (raw || "").replace(/[०-९]/g, (x) => String("०१२३४५६७८९".indexOf(x))).replace(/\D/g, "");
  return /^[2-9]\d{11}$/.test(d) ? d : null;
}
