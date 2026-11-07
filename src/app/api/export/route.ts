import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getLiveSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { asListKind, buildExport, fileBase, fileTag, filtersFrom, parseFields } from "@/lib/exportRows";
import { audit } from "@/lib/audit";
import { asLang, exportDictFor } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await getLiveSession();
  if (!s || !can(s.role, "export")) return new NextResponse("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const list = asListKind(url.searchParams.get("list"));
  const fields = parseFields(url.searchParams.get("fields"), list);
  const lang = asLang(url.searchParams.get("lang"));
  // the tab and search of the screen the download came from (7 Nov 2026)
  const filters = filtersFrom((k) => url.searchParams.get(k));
  // moved-out lists and the duplicates report are Admin / Operator screens
  if ((filters.moved || filters.memberMode === "moved" || list === "duplicates") && !can(s.role, "approve")) return new NextResponse("Forbidden", { status: 403 });
  const data = await buildExport(list, fields, lang, filters);
  const t = exportDictFor(lang);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Jain Sangh Nashik Road";
  const sheetName = { voters: t.voterList, families: t.headList, members: t.memberListShort, donations: t.dl_donationList, duplicates: t.dup_title }[list];
  const ws = wb.addWorksheet(sheetName.slice(0, 31), {
    pageSetup: { paperSize: 9, orientation: fields.length > 7 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: "frozen", ySplit: 3 }],
  });
  ws.mergeCells(1, 1, 1, fields.length);
  ws.getCell(1, 1).value = data.title;
  ws.getCell(1, 1).font = { bold: true, size: 14 };
  ws.mergeCells(2, 1, 2, fields.length);
  ws.getCell(2, 1).value = data.subtitle;
  const header = ws.getRow(3);
  data.headers.forEach((h, i) => {
    const c = header.getCell(i + 1);
    c.value = h;
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBE0E0" } };
    c.border = { bottom: { style: "thin" } };
  });
  data.rows.forEach((r) => ws.addRow(r));
  fields.forEach((f, i) => {
    const col = ws.getColumn(i + 1);
    col.width = ["fullName", "headName", "family1", "family2", "person1", "person2"].includes(f) ? 32 : f === "address" || f === "reasons" || f === "why" ? 40 : f === "mobile" || f === "phone" ? 13 : f === "serial" || f === "age" ? 7 : 14;
    if (f === "address") col.alignment = { wrapText: true, vertical: "top" };
  });
  ws.pageSetup.printTitlesRow = "3:3";

  const buf = await wb.xlsx.writeBuffer();
  await audit(s.uid, "export", list, null, { format: "xlsx", lang, fields, filters: { ...filters, q: filters.q ? "(search)" : "" }, rows: data.rows.length });
  const name = `${fileBase(list)}${fileTag(list, filters)}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
