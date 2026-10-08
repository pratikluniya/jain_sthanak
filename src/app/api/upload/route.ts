import { NextResponse } from "next/server";
import { getLiveSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { putFile } from "@/lib/storage";
import { runExtraction } from "@/lib/uploads";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // AI reading takes 20-60 s

export async function POST(req: Request) {
  const s = await getLiveSession();
  if (!s || !can(s.role, "upload")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const fd = await req.formData();
  const files = fd.getAll("pages").filter((f): f is File => typeof f === "object" && "arrayBuffer" in f && f.size > 0);
  if (files.length === 0 || files.length > 4) return NextResponse.json({ error: "1-4 pages" }, { status: 400 });

  const kind = fd.get("kind") === "INDIVIDUAL" ? "INDIVIDUAL" : "FAMILY";
  const up = await prisma.formUpload.create({ data: { imageKeys: [], uploadedBy: s.name, kind } });
  const keys: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const key = `${new Date().toISOString().slice(0, 10)}/${up.id}-p${i + 1}.jpg`;
    await putFile("forms", key, Buffer.from(await files[i].arrayBuffer()), "image/jpeg");
    keys.push(key);
  }
  await prisma.formUpload.update({ where: { id: up.id }, data: { imageKeys: keys } });
  await audit(s.uid, "upload", "Upload", up.id, { pages: keys.length, kind });

  // Without an AI key the upload stays "UPLOADED" and the volunteer types the form on the check screen.
  if (process.env.ANTHROPIC_API_KEY) await runExtraction(up.id);

  return NextResponse.json({ id: up.id });
}
