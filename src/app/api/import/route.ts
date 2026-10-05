// Admin batch import: the browser sends ONE form at a time (its JSON entry + its photos),
// so each request stays small. Aadhaar numbers are encrypted here before anything is saved.
import { NextResponse } from "next/server";
import { getLiveSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { importItem, type BatchItem } from "@/lib/importBatch";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const s = await getLiveSession();
  if (!s || !can(s.role, "settings")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const fd = await req.formData();
    const batch = String(fd.get("batch") ?? "");
    const item = JSON.parse(String(fd.get("item") ?? "{}")) as BatchItem;
    const files = new Map<string, File>();
    for (const [k, v] of fd.entries()) if (k === "files" && typeof v === "object") files.set((v as File).name, v as File);
    const r = await importItem(prisma, batch, item, async (name) => {
      const f = files.get(name);
      if (!f) throw new Error(`photo missing: ${name}`);
      return Buffer.from(await f.arrayBuffer());
    });
    if (r.status === "imported") await audit(s.uid, "import", "Upload", null, { batch, images: item.images, members: r.members, kyc: r.kyc });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
