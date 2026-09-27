// File storage: Supabase Storage in production, local ./uploads folder in development.
import { promises as fs } from "fs";
import path from "path";

type Bucket = "forms" | "kyc";
const LOCAL_ROOT = path.join(process.cwd(), "uploads");

function supabaseEnabled() {
  return process.env.STORAGE_DRIVER !== "local" && !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

async function supabase() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

function safeKey(key: string) {
  if (key.includes("..") || key.startsWith("/")) throw new Error("bad key");
  return key;
}

export async function putFile(bucket: Bucket, key: string, data: Buffer, contentType: string): Promise<void> {
  safeKey(key);
  if (supabaseEnabled()) {
    const sb = await supabase();
    const { error } = await sb.storage.from(bucket).upload(key, data, { contentType, upsert: true });
    if (error) throw error;
    return;
  }
  const p = path.join(LOCAL_ROOT, bucket, key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, data);
}

export async function getFile(bucket: Bucket, key: string): Promise<Buffer> {
  safeKey(key);
  if (supabaseEnabled()) {
    const sb = await supabase();
    const { data, error } = await sb.storage.from(bucket).download(key);
    if (error || !data) throw error ?? new Error("not found");
    return Buffer.from(await data.arrayBuffer());
  }
  return fs.readFile(path.join(LOCAL_ROOT, bucket, key));
}
