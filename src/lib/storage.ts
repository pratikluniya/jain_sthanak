// File storage for form photos and KYC scans.
//   STORAGE_DRIVER="s3"    -> DigitalOcean Spaces (S3-compatible; also works with AWS S3). Used in production.
//   STORAGE_DRIVER="local" -> ./uploads folder on disk. Used in development.
// One private bucket holds both kinds of files, kept apart by a prefix: "forms/..." and "kyc/...".
import { promises as fs } from "fs";
import path from "path";
import type { S3Client } from "@aws-sdk/client-s3";

type Bucket = "forms" | "kyc";
const LOCAL_ROOT = process.env.LOCAL_UPLOADS_DIR || path.join(process.cwd(), "uploads");
const LINK_SECONDS = 60 * 60; // private photo links work for 1 hour

function s3Enabled() {
  return process.env.STORAGE_DRIVER === "s3";
}

let client: S3Client | null = null;
async function s3() {
  if (client) return client;
  const { S3Client } = await import("@aws-sdk/client-s3");
  client = new S3Client({
    // DigitalOcean Spaces: endpoint https://blr1.digitaloceanspaces.com, region "us-east-1" (as DigitalOcean's docs say;
    // the real location comes from the endpoint), virtual-hosted style (forcePathStyle false).
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

function bucketName() {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error("S3_BUCKET is not set");
  return b;
}

function safeKey(key: string) {
  if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) throw new Error("bad key");
  return key;
}

const objectKey = (bucket: Bucket, key: string) => `${bucket}/${safeKey(key)}`;

export async function putFile(bucket: Bucket, key: string, data: Buffer, contentType: string): Promise<void> {
  if (s3Enabled()) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await s3()).send(
      new PutObjectCommand({ Bucket: bucketName(), Key: objectKey(bucket, key), Body: data, ContentType: contentType }),
    );
    return;
  }
  const p = path.join(LOCAL_ROOT, bucket, safeKey(key));
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, data);
}

export async function getFile(bucket: Bucket, key: string): Promise<Buffer> {
  if (s3Enabled()) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const res = await (await s3()).send(new GetObjectCommand({ Bucket: bucketName(), Key: objectKey(bucket, key) }));
    if (!res.Body) throw new Error("not found");
    return Buffer.from(await res.Body.transformToByteArray());
  }
  return fs.readFile(path.join(LOCAL_ROOT, bucket, safeKey(key)));
}

/**
 * URLs the browser can load form photos from.
 * Production: a private pre-signed bucket link valid for 1 hour (photo goes straight from the bucket to the phone).
 * Local: through our own logged-in route /api/files/forms/...
 * KYC scans never use this: they always go through /api/files/kyc so every view is permission-checked and logged.
 */
export async function formImageUrls(keys: string[]): Promise<string[]> {
  if (keys.length === 0) return [];
  const fallback = (k: string) => `/api/files/forms/${k}`;
  if (!s3Enabled()) return keys.map(fallback);
  try {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const c = await s3();
    return await Promise.all(
      keys.map((k) => getSignedUrl(c, new GetObjectCommand({ Bucket: bucketName(), Key: objectKey("forms", k) }), { expiresIn: LINK_SECONDS })),
    );
  } catch {
    return keys.map(fallback);
  }
}
