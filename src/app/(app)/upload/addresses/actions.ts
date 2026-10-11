"use server";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { flashErr, flashOk } from "@/lib/flash";
import { readAddressCsv } from "@/lib/addressCsv";

/**
 * Saves English addresses from the uploaded CSV. A "code" file changes saved families; an "upload" file
 * changes forms still waiting for a check (the check screen then shows that English address).
 * Blank cells and unchanged values are skipped.
 */
export async function importEnglishAddresses(fd: FormData) {
  const s = await requireSession("settings");
  const file = fd.get("file");
  if (!file || typeof file === "string" || !file.size) { flashErr("addrNoFile"); redirect("/upload/addresses"); }
  const { kind, rows, error } = readAddressCsv(await (file as File).text());
  if (error) { flashErr(error === "columns" ? "addrColumns" : "addrNoFile"); redirect("/upload/addresses"); }
  const unknown: string[] = [];
  let updated = 0;
  if (kind === "family") {
    const fams = await prisma.family.findMany({ where: { code: { in: rows.map((r) => r.key) }, deletedAt: null }, select: { id: true, code: true, addressEn: true } });
    const byCode = new Map(fams.map((f) => [f.code, f]));
    for (const r of rows) {
      const f = byCode.get(r.key);
      if (!f) { unknown.push(r.key); continue; }
      if (!r.addressEn || r.addressEn === f.addressEn) continue;
      await prisma.family.update({ where: { id: f.id }, data: { addressEn: r.addressEn } });
      await audit(s.uid, "update", "Family", f.id, { addressEn: { from: f.addressEn, to: r.addressEn }, via: "address-csv" });
      updated++;
    }
  } else {
    // only forms still waiting; a form saved meanwhile is reported as not found (fix it on the family instead)
    const ups = await prisma.formUpload.findMany({
      where: { id: { in: rows.map((r) => r.key) }, kind: "FAMILY", status: { in: ["EXTRACTED", "FAILED", "UPLOADED"] } },
      select: { id: true, extracted: true },
    });
    const byId = new Map(ups.map((u) => [u.id, u]));
    for (const r of rows) {
      const u = byId.get(r.key);
      if (!u || !u.extracted) { unknown.push(r.key); continue; }
      const x = u.extracted as Record<string, unknown>;
      if (!r.addressEn || r.addressEn === x.addressEn) continue;
      await prisma.formUpload.update({ where: { id: u.id }, data: { extracted: { ...x, addressEn: r.addressEn } as Prisma.InputJsonValue } });
      await audit(s.uid, "update", "Upload", u.id, { addressEn: { from: (x.addressEn as string) ?? "", to: r.addressEn }, via: "address-csv" });
      updated++;
    }
  }
  flashOk("addrUpdated", updated);
  redirect(`/upload/addresses?done=${updated}${unknown.length ? `&unknown=${encodeURIComponent(unknown.slice(0, 50).join(" "))}` : ""}`);
}
