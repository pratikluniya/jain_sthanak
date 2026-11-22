"use client";
// Turns the print view into a PDF file in the browser (no server work, Marathi letters stay correct).
// Each A4 page is captured separately as a picture, cutting only between table rows (column widths fixed and each
// page filled by its real height on screen, so no row can run past the paper: 22 Nov 2026),
// so long lists never hit the browser's canvas size limit. The page is a picture; invisible text behind it makes
// search and copy work (22 Nov 2026, src/lib/pdfText.ts).
import { startTask } from "@/lib/loader";
import { DEV_FONT, DEV_FONT_URL, cellText, scriptRuns } from "@/lib/pdfText";
import { useEffect, useRef, useState } from "react";


type Pdf = InstanceType<typeof import("jspdf").jsPDF>;

/** Invisible text over every cell of this page (title on page 1, table header, the page's rows), where the picture shows it. */
function addHiddenText(pdf: Pdf, root: HTMLElement, head: HTMLElement | null, pageRows: HTMLElement[], margin: number, mmPerPx: number, devFont: boolean) {
  const box = root.getBoundingClientRect();
  const cells: HTMLElement[] = [
    ...(head ? Array.from(head.querySelectorAll<HTMLElement>("h1, p")) : []),
    ...Array.from(root.querySelectorAll<HTMLElement>("thead th")),
    ...pageRows.flatMap((r) => Array.from(r.querySelectorAll<HTMLElement>("td"))),
  ];
  for (const el of cells) {
    const text = cellText(el.innerText || el.textContent || "");
    if (!text) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padT = parseFloat(cs.paddingTop) || 0;
    const sizePx = parseFloat(cs.fontSize) || 12;
    const x0 = margin + (r.left - box.left + padL) * mmPerPx;
    const y = margin + (r.top - box.top + padT) * mmPerPx;
    const room = Math.max(1, (r.width - 2 * padL) * mmPerPx);
    const sizePt = sizePx * mmPerPx * 2.8346;
    const runs = scriptRuns(text).filter((x) => !x.dev || devFont);
    pdf.setFontSize(sizePt);
    const widths = runs.map((x) => {
      pdf.setFont(x.dev ? DEV_FONT : "helvetica", "normal");
      return pdf.getTextWidth(x.text);
    });
    const total = widths.reduce((a, b) => a + b, 0);
    const scale = total > room ? room / total : 1; // squeeze a long cell into its own width so cells do not overlap
    let x = x0;
    runs.forEach((run, k) => {
      pdf.setFont(run.dev ? DEV_FONT : "helvetica", "normal");
      pdf.text(run.text, x, y, { baseline: "top", renderingMode: "invisible", horizontalScale: scale });
      x += widths[k] * scale;
    });
  }
  pdf.setFont("helvetica", "normal");
}

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
      // font for the hidden Devanagari text; without it the PDF is still made, only not searchable in Marathi
      let devFont = false;
      try {
        const buf = new Uint8Array(await (await fetch(DEV_FONT_URL)).arrayBuffer());
        let bin = "";
        for (let k = 0; k < buf.length; k += 0x8000) bin += String.fromCharCode(...buf.subarray(k, k + 0x8000));
        pdf.addFileToVFS("dev-search.ttf", btoa(bin));
        pdf.addFont("dev-search.ttf", DEV_FONT, "normal");
        devFont = true;
      } catch {
        /* picture only */
      }
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
        addHiddenText(pdf, root, i === 0 ? head : null, pages[i], margin, (wMm / contentWmm) / pxPerMm, devFont);
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

