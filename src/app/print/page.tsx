import { requireSession } from "@/lib/session";
import { buildExport, parseFields, type ListKind } from "@/lib/exportRows";
import { audit } from "@/lib/audit";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

// Print-ready A4 page. The browser renders Devanagari correctly; "Save as PDF" in the print dialog gives the PDF.
export default async function PrintPage({ searchParams }: { searchParams: { list?: string; fields?: string } }) {
  const s = await requireSession("export");
  const list: ListKind = searchParams.list === "members" ? "members" : "voters";
  const fields = parseFields(searchParams.fields, list);
  const data = await buildExport(list, fields);
  await audit(s.uid, "export", list, null, { format: "print", fields, rows: data.rows.length });
  const landscape = fields.length > 7;

  return (
    <div className="bg-white min-h-screen p-4 print:p-0">
      <style>{`@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 12mm 10mm; }
        table { border-collapse: collapse; width: 100%; font-size: 11px; }
        th, td { border: 1px solid #999; padding: 3px 5px; vertical-align: top; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }`}</style>
      <div className="no-print mb-4 flex gap-2">
        <PrintButton />
      </div>
      <div className="flex items-center gap-3 justify-center" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-14 w-auto" />
        <h1 className="text-lg font-bold text-center">{data.title}</h1>
      </div>
      <div className="jain-stripe my-2" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }} />
      <p className="text-center text-sm mb-3">{data.subtitle}</p>
      <table>
        <thead>
          <tr className="bg-red-50">{data.headers.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {data.rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
