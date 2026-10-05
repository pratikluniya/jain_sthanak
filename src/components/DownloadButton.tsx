"use client";
// "Download" button + popup: pick columns and language, then Excel, Print, or a PDF made in the browser.
import { useEffect, useState } from "react";
import Icon from "./Icon";

export interface DownloadLabels {
  download: string;
  downloadTitle: string;
  chooseFields: string;
  exportLanguage: string;
  downloadExcel: string;
  printList: string;
  downloadPdf: string;
  pdfNote: string;
  defaultColumns: string;
  pickOneColumn: string;
  close: string;
}

export default function DownloadButton(props: {
  list: "voters" | "members" | "families";
  title: string;
  fields: { key: string; label: string }[];
  defaults: string[];
  langs: { code: string; label: string }[];
  initialLang: string;
  t: DownloadLabels;
}) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState(props.initialLang);
  const [picked, setPicked] = useState<string[]>(props.defaults);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // keep the standard column order whatever order they were ticked in
  const ordered = props.fields.map((f) => f.key).filter((k) => picked.includes(k));
  const qs = `list=${props.list}&fields=${ordered.join(",")}&lang=${lang}`;
  const none = ordered.length === 0;
  const off = none ? "pointer-events-none opacity-50" : "";

  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        <Icon name="download" className="h-4 w-4" /> {props.t.download}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={props.t.downloadTitle}
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-bold">{props.t.downloadTitle}</h2>
                <p className="text-sm text-stone-500">{props.title}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100" aria-label={props.t.close}>
                <Icon name="close" />
              </button>
            </div>

            <p className="label">{props.t.exportLanguage}</p>
            <div className="mb-4 inline-flex overflow-hidden rounded-lg border border-stone-300 text-sm">
              {props.langs.map((l) => (
                <button key={l.code} type="button" onClick={() => setLang(l.code)} className={`px-3 py-1.5 ${lang === l.code ? "bg-brand-600 text-white" : "bg-white text-stone-800"}`}>
                  {l.label}
                </button>
              ))}
            </div>

            <div className="mb-1 flex items-center justify-between">
              <p className="label mb-0">{props.t.chooseFields}</p>
              <button type="button" className="text-xs text-brand-700 underline" onClick={() => setPicked(props.defaults)}>{props.t.defaultColumns}</button>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-stone-200 p-3 sm:grid-cols-3">
              {props.fields.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={picked.includes(f.key)}
                    onChange={(e) => setPicked((p) => (e.target.checked ? [...p, f.key] : p.filter((x) => x !== f.key)))}
                  />
                  {f.label}
                </label>
              ))}
            </div>
            {none && <p className="mb-3 text-sm text-red-600">{props.t.pickOneColumn}</p>}

            <div className="flex flex-wrap gap-2">
              <a className={`btn-primary ${off}`} href={`/api/export?${qs}`} aria-disabled={none}>
                <Icon name="download" className="h-4 w-4" /> {props.t.downloadExcel}
              </a>
              <a className={`btn-secondary ${off}`} href={`/print?${qs}`} target="_blank" rel="noopener" aria-disabled={none}>
                🖨 {props.t.printList}
              </a>
              <a className={`btn-secondary ${off}`} href={`/print?${qs}&pdf=1`} target="_blank" rel="noopener" aria-disabled={none}>
                📄 {props.t.downloadPdf}
              </a>
            </div>
            <p className="mt-3 text-xs text-stone-500">{props.t.pdfNote}</p>
          </div>
        </div>
      )}
    </>
  );
}
