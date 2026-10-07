"use client";
// Turns the print view into a PDF file in the browser (no server work, Marathi letters stay correct).
// Each A4 page is captured separately as a picture, cutting only between table rows,
// so long lists never hit the browser's canvas size limit. The text in the PDF is a picture (not searchable).
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
      const thead = root.querySelector<HTMLElement>("thead");
      const rows = Array.from(root.querySelectorAll<HTMLElement>("tbody tr"));
      const headH = head?.offsetHeight ?? 0;
      const theadH = thead?.offsetHeight ?? 0;

      // group rows into pages: title block on page 1 only, table header on every page
      const pages: HTMLElement[][] = [];
      let current: HTMLElement[] = [];
      let used = headH + theadH;
      for (const r of rows) {
        if (used + r.offsetHeight > pageHeightPx && current.length) {
          pages.push(current);
          current = [];
          used = theadH;
        }
        current.push(r);
        used += r.offsetHeight;
      }
      pages.push(current);

      for (let i = 0; i < pages.length; i++) {
        setProgress(`${i + 1} / ${pages.length}`);
        if (head) head.style.display = i === 0 ? "" : "none";
        const keep = new Set(pages[i]);
        rows.forEach((r) => (r.style.display = keep.has(r) ? "" : "none"));
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
        const hMm = canvas.height / 2 / pxPerMm;
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", margin, margin, contentWmm, hMm);
        pdf.setFontSize(8);
        pdf.text(`${i + 1} / ${pages.length}`, pageW / 2, pageH - margin / 2, { align: "center" });
      }
      if (head) head.style.display = "";
      rows.forEach((r) => (r.style.display = ""));
      pdf.save(props.fileName);
      setState("ready");
    })().catch(() => setState("failed"));
  }, [props]);

  return (
    <div className="no-print mb-4 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm" role="status">
      {state === "making" && <span>⏳ {props.t.making} {progress}</span>}
      {state === "ready" && <span className="text-green-700">✔ {props.t.ready}</span>}
      {state === "failed" && <span className="text-red-600">{props.t.failed}</span>}
    </div>
  );
}

