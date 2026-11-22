"use client";
// Turns the print view into a PDF file in the browser (no server work, Marathi letters stay correct).
// Each A4 page is captured separately as a picture, cutting only between table rows (column widths fixed and each
// page filled by its real height on screen, so no row can run past the paper: 22 Nov 2026),
// so long lists never hit the browser's canvas size limit. The text in the PDF is a picture (not searchable).
import { startTask } from "@/lib/loader";
import { useEffect, useRef, useState } from "react";


export default function PdfMaker(props: {
  rootId: string;
  fileName: string;
  landscape: boolean;
  t: { making: string; ready: string; failed: string };
}) {
  const [state, setState] = useState<"making" | "ready" | "failed">("making");
  const [progress, setProgress] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // React dev mode runs effects twice
    started.current = true;
    const busy = startTask(); // logo loader with the real page progress
    (async () => {
      const root = document.getElementById(props.rootId);
      if (!root) throw new Error("no print root");
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      await document.fonts.ready;

      const pdf = new jsPDF({ orientation: props.landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const footer = 6; // room for the page number
      const contentWmm = pageW - 2 * margin;
      const contentHmm = pageH - 2 * margin - footer;
      const pxPerMm = root.offsetWidth / contentWmm;
      const pageHeightPx = contentHmm * pxPerMm;

      const head = root.querySelector<HTMLElement>("[data-pdf-head]");
      const table = root.querySelector<HTMLElement>("table");
      const ths = Array.from(root.querySelectorAll<HTMLElement>("thead th"));
      const rows = Array.from(root.querySelectorAll<HTMLElement>("tbody tr"));

      // Fix the column widths as laid out with every row (22 Nov 2026). With automatic widths, a page showing only
      // its own rows got different widths, names wrapped onto more lines, the picture grew taller than the paper
      // and the last rows of the page were cut off (e.g. 1400-1402 missing from a voter list).
      const widths = ths.map((th) => th.getBoundingClientRect().width);
      ths.forEach((th, k) => (th.style.width = `${widths[k]}px`));
      if (table) table.style.tableLayout = "fixed";

      const showOnly = (pageRows: HTMLElement[], first: boolean) => {
        if (head) head.style.display = first ? "" : "none";
        const keep = new Set(pageRows);
        rows.forEach((r) => (r.style.display = keep.has(r) ? "" : "none"));
      };

      // Fill each page row by row and check the real height on screen, so nothing can run past the paper.
      const overflow: number[] = []; // pages still taller than the paper (only if one row alone is taller)
      const pages: HTMLElement[][] = [];
      rows.forEach((r) => (r.style.display = "none"));
      let next = 0;
      do {
        const first = pages.length === 0;
        if (head) head.style.display = first ? "" : "none";
        const page: HTMLElement[] = [];
        while (next < rows.length) {
          const r = rows[next];
          r.style.display = "";
          if (page.length > 0 && root.offsetHeight > pageHeightPx) {
            r.style.display = "none"; // starts the next page
            break;
          }
          page.push(r);
          next++;
        }
        page.forEach((r) => (r.style.display = "none"));
        pages.push(page);
      } while (next < rows.length);

      for (let i = 0; i < pages.length; i++) {
        setProgress(`${i + 1} / ${pages.length}`);
        busy.progress(i / pages.length);
        showOnly(pages[i], i === 0);
        const canvas = await html2canvas(root, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
          // html2canvas draws text lower than the browser when Tailwind's reset makes images block-level;
          // this is the known workaround so the text sits inside its table cell.
          onclone: (doc) => {
            const st = doc.createElement("style");
            st.textContent = "img { display: inline-block !important; }";
            doc.head.appendChild(st);
          },
        });
        let hMm = canvas.height / 2 / pxPerMm;
        let wMm = contentWmm;
        if (hMm > contentHmm + 0.5) {
          // safety net: shrink the picture to fit the paper rather than lose rows
          overflow.push(i + 1);
          wMm = (contentWmm * contentHmm) / hMm;
          hMm = contentHmm;
        }
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", margin, margin, wMm, hMm);
        pdf.setFontSize(8);
        pdf.text(`${i + 1} / ${pages.length}`, pageW / 2, pageH - margin / 2, { align: "center" });
      }
      if (head) head.style.display = "";
      rows.forEach((r) => (r.style.display = ""));
      ths.forEach((th) => (th.style.width = ""));
      if (table) table.style.tableLayout = "";
      root.dataset.pdfOverflow = overflow.join(",");
      root.dataset.pdfPages = String(pages.length);
      pdf.save(props.fileName);
      setState("ready");
    })()
      .catch(() => setState("failed"))
      .finally(() => busy.end());
  }, [props]);

  return (
    <div className="no-print mb-4 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm" role="status">
      {state === "making" && <span>⏳ {props.t.making} {progress}</span>}
      {state === "ready" && <span className="text-green-700">✔ {props.t.ready}</span>}
      {state === "failed" && <span className="text-red-600">{props.t.failed}</span>}
    </div>
  );
}

