// Excel of the "unpaid for N years" list (23 Oct 2026).
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getLiveSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { asLang, exportDictFor } from "@/lib/i18n";
import { collator, headLabel } from "@/lib/members";
import { DONATION_KINDS, arrearsFor, asKindOrAll, asMinYears } from "@/lib/donations";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await getLiveSession();
  if (!s || !can(s.role, "export")) return new NextResponse("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const lang = asLang(url.searchParams.get("lang"));
  const min = asMinYears(url.searchParams.get("min"));
  const kind = asKindOrAll(url.searchParams.get("kind"));
  const t = exportDictFor(lang);
  const rows = (await arrearsFor(min, kind)).sort((a, b) => collator.compare(a.family.code, b.family.code));

  const headers = ["#", t.familyCode, t.headName, t.mobile, ...DONATION_KINDS.map((k) => `${t[k]}: ${t.unpaidYears}`), `${t.pendingAmount} (₹)`];
  const wb = new ExcelJS.Workbook();
  wb.creator = "Jain Sangh Nashik Road";
  const ws = wb.addWorksheet(t.arrears, { views: [{ state: "frozen", ySplit: 3 }], pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.mergeCells(1, 1, 1, headers.length);
  ws.getCell(1, 1).value = `${t.sangh}: ${t.arrears}`;
  ws.getCell(1, 1).font = { bold: true, size: 14 };
  ws.mergeCells(2, 1, 2, headers.length);
  ws.getCell(2, 1).value = `${t.unpaidYearsInRow}: ${min} ${t.orMore} · ${t[kind]} · ${new Date().toLocaleDateString("en-IN")}`;
  const h = ws.getRow(3);
  headers.forEach((x, i) => {
    const c = h.getCell(i + 1);
    c.value = x;
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBE0E0" } };
  });
  rows.forEach((r, i) =>
    ws.addRow([i + 1, r.family.code, headLabel(r.family, lang === "en"), r.family.mobile, ...DONATION_KINDS.map((k) => r.unpaidYears[k].join(", ")), r.pendingAmount]),
  );
  [5, 12, 34, 13, 22, 22, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const buf = await wb.xlsx.writeBuffer();
  await audit(s.uid, "export", "DonationArrears", null, { min, kind, lang, rows: rows.length });
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="donation-arrears-${min}plus-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
