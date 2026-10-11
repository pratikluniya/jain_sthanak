// Admin: download every family's address with its English spelling (saved, or the automatic one)
// so the English column can be checked and uploaded back on /upload/addresses.
import { NextResponse } from "next/server";
import { getLiveSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { addressToEnglish } from "@/lib/addressEn";
import { ADDRESS_CSV_HEADER, FORMS_CSV_HEADER, toCsv } from "@/lib/addressCsv";
import type { ExtractedForm } from "@/lib/extract";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await getLiveSession();
  if (!s || !can(s.role, "settings")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (new URL(req.url).searchParams.get("list") === "forms") return formsCsv();
  const fams = await prisma.family.findMany({
    where: { deletedAt: null },
    orderBy: { code: "asc" },
    select: { code: true, headName: true, address: true, addressEn: true },
  });
  const csv = toCsv([ADDRESS_CSV_HEADER, ...fams.map((f) => [f.code, f.headName, f.address, f.addressEn || addressToEnglish(f.address)])]);
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="family-addresses.csv"' },
  });
}

/** Family forms still waiting for a volunteer's check, oldest first (blank addresses included). */
async function formsCsv() {
  const ups = await prisma.formUpload.findMany({
    where: { kind: "FAMILY", status: { in: ["EXTRACTED", "FAILED", "UPLOADED"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, extracted: true, uploadedBy: true },
  });
  const rows = ups.map((u) => {
    const x = (u.extracted ?? {}) as Partial<ExtractedForm>;
    const address = x.address ?? "";
    const form = u.uploadedBy.startsWith("import:") ? u.uploadedBy.slice(7) : "(uploaded in app)";
    return [u.id, form, x.headName ?? "", address, x.addressEn || addressToEnglish(address)];
  });
  return new NextResponse(toCsv([FORMS_CSV_HEADER, ...rows]), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="waiting-form-addresses.csv"' },
  });
}
