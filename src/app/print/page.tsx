import { requireSession } from "@/lib/session";
import { asListKind, buildExport, fileBase, parseFields } from "@/lib/exportRows";
import { audit } from "@/lib/audit";
import { asLang, getDict } from "@/lib/i18n";
import PdfMaker from "@/components/PdfMaker";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

// Print-ready A4 page. The browser renders Devanagari correctly; "Save as PDF" in the print dialog gives the PDF.
export default async function PrintPage({ searchParams }: { searchParams: { list?: string; fields?: string; lang?: string; pdf?: string } }) {
  const s = await requireSession("export");
  const list = asListKind(searchParams.list);
  const asPdf = searchParams.pdf === "1";
  const ui = getDict();
  const fields = parseFields(searchParams.fields, list);
  const lang = asLang(searchParams.lang);
  const data = await buildExport(list, fields, lang);
  await audit(s.uid, "export", list, null, { format: asPdf ? "pdf" : "print", lang, fields, rows: data.rows.length });
  const landscape = fields.length > 7;

  return (
    <div lang={lang} className="bg-white min-h-screen p-4 print:p-0">
      <style>{`@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 12mm 10mm; }
        table { border-collapse: collapse; width: 100%; font-size: 11px; }
        th, td { border: 1px solid #999; padding: 3px 5px; vertical-align: top; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        ${/* PDF picture: html2canvas draws Devanagari a few pixels lower than the browser, so give the text room above the cell border */ ""}
        ${asPdf ? "#print-root th, #print-root td { padding-bottom: 8px; }" : ""}`}</style>
      {asPdf ? (
        <PdfMaker
          rootId="print-root"
          fileName={`${fileBase(list)}-${new Date().toISOString().slice(0, 10)}.pdf`}
          landscape={landscape}
          t={{ making: ui.makingPdf, ready: ui.pdfReady, failed: ui.pdfFailed }}
        />
      ) : (
        <div className="no-print mb-4 flex gap-2">
          <PrintButton />
        </div>
      )}
      {/* in PDF mode the page is laid out at the A4 content width (190 / 277 mm) so the picture matches the paper */}
      <div id="print-root" className="bg-white" style={asPdf ? { width: `${Math.round((landscape ? 277 : 190) * 3.7795)}px` } : undefined}>
      <div data-pdf-head>
      <div className="flex items-center gap-3 justify-center" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-14 w-auto" />
        <h1 className="text-lg font-bold text-center">{data.title}</h1>
      </div>
      <div className="jain-stripe my-2" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }} />
      <p className="text-center text-sm mb-3">{data.subtitle}</p>
      </div>
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
    </div>
  );
}
