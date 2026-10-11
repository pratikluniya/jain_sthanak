// Admin: download every family's address with its English spelling (saved, or the automatic one)
// so the English column can be checked and uploaded back on /upload/addresses.
import { NextResponse } from "next/server";
import { getLiveSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { addressToEnglish } from "@/lib/addressEn";
import { ADDRESS_CSV_HEADER, toCsv } from "@/lib/addressCsv";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getLiveSession();
  if (!s || !can(s.role, "settings")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
