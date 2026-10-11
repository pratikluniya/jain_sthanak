"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { flashErr, flashOk } from "@/lib/flash";
import { readAddressCsv } from "@/lib/addressCsv";

/** Saves the English address of each family code in the uploaded CSV. Blank cells and unchanged values are skipped. */
export async function importEnglishAddresses(fd: FormData) {
  const s = await requireSession("settings");
  const file = fd.get("file");
  if (!file || typeof file === "string" || !file.size) { flashErr("addrNoFile"); redirect("/upload/addresses"); }
  const { rows, error } = readAddressCsv(await (file as File).text());
  if (error) { flashErr(error === "columns" ? "addrColumns" : "addrNoFile"); redirect("/upload/addresses"); }
  const fams = await prisma.family.findMany({ where: { code: { in: rows.map((r) => r.code) }, deletedAt: null }, select: { id: true, code: true, addressEn: true } });
  const byCode = new Map(fams.map((f) => [f.code, f]));
  const unknown: string[] = [];
  let updated = 0;
  for (const r of rows) {
    const f = byCode.get(r.code);
    if (!f) { unknown.push(r.code); continue; }
    if (!r.addressEn || r.addressEn === f.addressEn) continue;
    await prisma.family.update({ where: { id: f.id }, data: { addressEn: r.addressEn } });
    await audit(s.uid, "update", "Family", f.id, { addressEn: { from: f.addressEn, to: r.addressEn }, via: "address-csv" });
    updated++;
  }
  flashOk("addrUpdated", updated);
  redirect(`/upload/addresses?done=${updated}${unknown.length ? `&unknown=${encodeURIComponent(unknown.slice(0, 50).join(" "))}` : ""}`);
}
